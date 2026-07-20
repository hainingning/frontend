"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";
import { ConfirmButton } from "@workspace/ui/composed/confirm-button";
import {
  ProTable,
  type ProTableActions,
} from "@workspace/ui/composed/pro-table/pro-table";
import {
  batchDeleteSubscribe,
  createSubscribe,
  deleteSubscribe,
  getSubscribeList,
  subscribeSort,
  updateSubscribe,
} from "@workspace/ui/services/admin/subscribe";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Display } from "@/components/display";
import { useSubscribe } from "@/stores/subscribe";
import SubscribeForm from "./subscribe-form";

type SubscribeStatus = {
  sell: boolean;
  show: boolean;
};

type PendingStatusUpdate = {
  item: API.SubscribeItem;
  revision: number;
};

function AnimatedStatusSwitch({
  checked,
  disabled,
  onCheckedChange,
}: {
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const [visualChecked, setVisualChecked] = useState(checked);

  useEffect(() => {
    setVisualChecked(checked);
  }, [checked]);

  return (
    <Switch
      checked={visualChecked}
      disabled={disabled}
      onCheckedChange={(nextChecked) => {
        setVisualChecked(nextChecked);
        onCheckedChange(nextChecked);
      }}
    />
  );
}

export default function SubscribeTable() {
  const { t } = useTranslation("product");
  const [loading, setLoading] = useState(false);
  const ref = useRef<ProTableActions>(null);
  const statusOverrides = useRef(new Map<number, SubscribeStatus>());
  const pendingStatusUpdates = useRef(new Map<number, PendingStatusUpdate>());
  const { fetchSubscribes } = useSubscribe();

  const refreshSubscribeData = () => {
    ref.current?.refresh();
    fetchSubscribes();
  };

  const persistStatusUpdate = async (
    id: number,
    pending: PendingStatusUpdate
  ) => {
    while (pendingStatusUpdates.current.get(id) === pending) {
      const revision = pending.revision;
      const payload = {
        ...pending.item,
        // The list API represents an empty node tag as [""]. Sending that value
        // back makes the server clear the explicitly selected nodes.
        node_tags: pending.item.node_tags?.filter(Boolean),
      } as API.UpdateSubscribeRequest;

      try {
        await updateSubscribe(payload);
      } catch {
        if (pendingStatusUpdates.current.get(id) === pending) {
          pendingStatusUpdates.current.delete(id);
          statusOverrides.current.delete(id);
        }
        toast.error(t("updateError", "Update failed"));
        refreshSubscribeData();
        return;
      }

      if (revision === pending.revision) {
        pendingStatusUpdates.current.delete(id);
        // Keep the optimistic values visible until the refreshed list arrives.
        // The request callback below removes the override after fresh data is read.
        refreshSubscribeData();
        return;
      }
    }
  };

  const updateStatus = (
    item: API.SubscribeItem,
    field: keyof SubscribeStatus,
    checked: boolean
  ) => {
    if (item.id === undefined) return;

    const id = item.id;
    const existing = pendingStatusUpdates.current.get(id);
    const currentStatus = existing
      ? {
          sell: Boolean(existing.item.sell),
          show: Boolean(existing.item.show),
        }
      : statusOverrides.current.get(id) || {
          sell: Boolean(item.sell),
          show: Boolean(item.show),
        };
    const nextStatus = { ...currentStatus, [field]: checked };

    statusOverrides.current.set(id, nextStatus);

    if (existing) {
      existing.item = { ...existing.item, ...nextStatus };
      existing.revision += 1;
      return;
    }

    const pending = {
      item: { ...item, ...nextStatus },
      revision: 0,
    };
    pendingStatusUpdates.current.set(id, pending);
    persistStatusUpdate(id, pending);
  };

  const getStatus = (item: API.SubscribeItem): SubscribeStatus =>
    (item.id === undefined
      ? undefined
      : statusOverrides.current.get(item.id)) || {
      sell: Boolean(item.sell),
      show: Boolean(item.show),
    };

  return (
    <ProTable<API.SubscribeItem, { group_id: number; query: string }>
      action={ref}
      actions={{
        render: (row) => [
          <SubscribeForm<API.SubscribeItem>
            initialValues={row}
            key="edit"
            loading={loading}
            onSubmit={async (values) => {
              setLoading(true);
              try {
                await updateSubscribe({
                  ...row,
                  ...values,
                } as API.UpdateSubscribeRequest);
                toast.success(t("updateSuccess"));
                ref.current?.refresh();
                fetchSubscribes();
                setLoading(false);
                return true;
              } catch {
                setLoading(false);

                return false;
              }
            }}
            title={t("editSubscribe")}
            trigger={t("edit")}
          />,
          <ConfirmButton
            cancelText={t("cancel")}
            confirmText={t("confirm")}
            description={t("deleteWarning")}
            key="delete"
            onConfirm={async () => {
              await deleteSubscribe({
                id: row.id!,
              });
              toast.success(t("deleteSuccess"));
              ref.current?.refresh();
              fetchSubscribes();
            }}
            title={t("confirmDelete")}
            trigger={<Button variant="destructive">{t("delete")}</Button>}
          />,
          <Button
            key="copy"
            onClick={async () => {
              setLoading(true);
              try {
                const {
                  id: _id,
                  sort: _sort,
                  sell: _sell,
                  updated_at: _updated_at,
                  created_at: _created_at,
                  ...params
                } = row;
                await createSubscribe({
                  ...params,
                  show: false,
                  sell: false,
                } as API.CreateSubscribeRequest);
                toast.success(t("copySuccess"));
                ref.current?.refresh();
                fetchSubscribes();
                setLoading(false);
                return true;
              } catch {
                setLoading(false);
                return false;
              }
            }}
            variant="secondary"
          >
            {t("copy")}
          </Button>,
        ],
        batchRender: (rows) => [
          <ConfirmButton
            cancelText={t("cancel")}
            confirmText={t("confirm")}
            description={t("deleteWarning")}
            key="delete"
            onConfirm={async () => {
              await batchDeleteSubscribe({
                ids: rows.map((item) => item.id) as number[],
              });

              toast.success(t("deleteSuccess"));
              ref.current?.reset();
              fetchSubscribes();
            }}
            title={t("confirmDelete")}
            trigger={<Button variant="destructive">{t("delete")}</Button>}
          />,
        ],
      }}
      columns={[
        {
          accessorKey: "show",
          header: t("show"),
          cell: ({ row }) => (
            <AnimatedStatusSwitch
              checked={getStatus(row.original).show}
              disabled={row.original.id === undefined}
              onCheckedChange={(checked) =>
                updateStatus(row.original, "show", checked)
              }
            />
          ),
        },
        {
          accessorKey: "sell",
          header: t("sell"),
          cell: ({ row }) => (
            <AnimatedStatusSwitch
              checked={getStatus(row.original).sell}
              disabled={row.original.id === undefined}
              onCheckedChange={(checked) =>
                updateStatus(row.original, "sell", checked)
              }
            />
          ),
        },
        {
          accessorKey: "name",
          header: t("name"),
        },
        {
          accessorKey: "unit_price",
          header: t("unitPrice"),
          cell: ({ row }) => (
            <>
              <Display type="currency" value={row.getValue("unit_price")} />/
              {t(
                row.original.unit_time
                  ? `form.${row.original.unit_time}`
                  : "form.Month"
              )}
            </>
          ),
        },
        {
          accessorKey: "replacement",
          header: t("replacement"),
          cell: ({ row }) => (
            <Display type="currency" value={row.getValue("replacement")} />
          ),
        },
        {
          accessorKey: "traffic",
          header: t("traffic"),
          cell: ({ row }) => (
            <Display type="traffic" unlimited value={row.getValue("traffic")} />
          ),
        },
        {
          accessorKey: "device_limit",
          header: t("deviceLimit"),
          cell: ({ row }) => (
            <Display
              type="number"
              unlimited
              value={row.getValue("device_limit")}
            />
          ),
        },
        {
          accessorKey: "inventory",
          header: t("inventory"),
          cell: ({ row }) => {
            const inventory = row.getValue("inventory") as number;
            return inventory === -1 ? (
              <Display type="number" unlimited value={0} />
            ) : (
              <Display type="number" unlimited value={inventory} />
            );
          },
        },
        {
          accessorKey: "quota",
          header: t("quota"),
          cell: ({ row }) => (
            <Display type="number" unlimited value={row.getValue("quota")} />
          ),
        },
        {
          accessorKey: "language",
          header: t("language"),
          cell: ({ row }) => {
            const language = row.getValue("language") as string;
            return language ? (
              <Badge variant="outline">{language}</Badge>
            ) : (
              "--"
            );
          },
        },
        {
          accessorKey: "sold",
          header: t("sold"),
          cell: ({ row }) => (
            <Badge variant="outline">{row.getValue("sold")}</Badge>
          ),
        },
      ]}
      header={{
        toolbar: (
          <SubscribeForm<API.CreateSubscribeRequest>
            loading={loading}
            onSubmit={async (values) => {
              setLoading(true);
              try {
                await createSubscribe({
                  ...values,
                  show: false,
                  sell: false,
                });
                toast.success(t("createSuccess"));
                ref.current?.refresh();
                fetchSubscribes();
                setLoading(false);

                return true;
              } catch {
                setLoading(false);

                return false;
              }
            }}
            title={t("createSubscribe")}
            trigger={t("create")}
          />
        ),
      }}
      onSort={async (source, target, items) => {
        const sourceIndex = items.findIndex(
          (item) => String(item.id) === source
        );
        const targetIndex = items.findIndex(
          (item) => String(item.id) === target
        );

        const originalSorts = items.map((item) => item.sort);

        const [movedItem] = items.splice(sourceIndex, 1);
        items.splice(targetIndex, 0, movedItem!);

        const updatedItems = items.map((item, index) => {
          const originalSort = originalSorts[index];
          const newSort = originalSort !== undefined ? originalSort : item.sort;
          return { ...item, sort: newSort };
        });

        const changedItems = updatedItems.filter(
          (item, index) => item.sort !== items[index]?.sort
        );

        if (changedItems.length > 0) {
          await subscribeSort({
            sort: changedItems.map((item) => ({
              id: item.id,
              sort: item.sort,
            })) as API.SortItem[],
          });
          toast.success(t("sortSuccess", "Sort completed successfully"));
        }

        return updatedItems;
      }}
      params={[
        {
          key: "search",
        },
      ]}
      request={async (pagination, filters) => {
        const { data } = await getSubscribeList({
          ...pagination,
          ...filters,
        });
        const list = data.data?.list || [];
        for (const item of list) {
          if (
            item.id !== undefined &&
            !pendingStatusUpdates.current.has(item.id)
          ) {
            statusOverrides.current.delete(item.id);
          }
        }
        return {
          list,
          total: data.data?.total || 0,
        };
      }}
    />
  );
}
