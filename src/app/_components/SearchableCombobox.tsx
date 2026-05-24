"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";

import { Button } from "@/app/_components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/app/_components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_components/ui/popover";
import { cn } from "@/app/_lib/utils";

type Result<T> =
  | { kind: "ok"; key: string; items: T[] }
  | { kind: "error"; key: string; message: string };

type CommonProps<T> = {
  loadItems: (query: string, signal: AbortSignal) => Promise<T[]>;
  cacheKey: string;
  filter?: "remote" | "local";
  getKey: (item: T) => string;
  getSearchText?: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  triggerLabel: React.ReactNode;
  searchPlaceholder?: string;
  emptyMessage?: string;
  toErrorMessage?: (err: unknown) => string;
  debounceMs?: number;
  disabled?: boolean;
  className?: string;
};

type SingleProps<T> = CommonProps<T> & {
  mode?: "single";
  selectedKey: string | null;
  onSelect: (item: T) => void;
};

type MultipleProps<T> = CommonProps<T> & {
  mode: "multiple";
  selectedKeys: string[];
  onToggle: (item: T) => void;
};

export type SearchableComboboxProps<T> = SingleProps<T> | MultipleProps<T>;

export function SearchableCombobox<T>(props: SearchableComboboxProps<T>) {
  const {
    loadItems,
    cacheKey,
    filter = "remote",
    getKey,
    getSearchText,
    renderItem,
    triggerLabel,
    searchPlaceholder = "Search…",
    emptyMessage = "No results.",
    toErrorMessage,
    debounceMs = 250,
    disabled,
    className,
  } = props;

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");

  React.useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), debounceMs);
    return () => clearTimeout(handle);
  }, [query, debounceMs]);

  const remoteQuery = filter === "remote" ? debouncedQuery : "";
  const requestKey = `${cacheKey}::${remoteQuery}`;

  const [result, setResult] = React.useState<Result<T> | null>(null);
  const loading = result?.key !== requestKey;

  const loadItemsRef = React.useRef(loadItems);
  const toErrorMessageRef = React.useRef(toErrorMessage);
  React.useEffect(() => {
    loadItemsRef.current = loadItems;
    toErrorMessageRef.current = toErrorMessage;
  });

  React.useEffect(() => {
    const controller = new AbortController();
    loadItemsRef
      .current(remoteQuery, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setResult({ kind: "ok", key: requestKey, items });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          toErrorMessageRef.current?.(err) ??
          (err instanceof Error ? err.message : "Failed to load");
        setResult({ kind: "error", key: requestKey, message });
      });
    return () => controller.abort();
  }, [requestKey, remoteQuery]);

  const visibleItems = React.useMemo(() => {
    if (loading || result?.kind !== "ok") return [];
    if (filter === "remote" || !debouncedQuery) return result.items;
    const q = debouncedQuery.toLowerCase();
    return result.items.filter((item) => {
      const text = (getSearchText ? getSearchText(item) : getKey(item)).toLowerCase();
      return text.includes(q);
    });
  }, [loading, result, filter, debouncedQuery, getSearchText, getKey]);

  const isMultiple = props.mode === "multiple";
  const isSelected = (item: T) => {
    const key = getKey(item);
    if (props.mode === "multiple") return props.selectedKeys.includes(key);
    return props.selectedKey === key;
  };

  const handleSelect = (item: T) => {
    if (props.mode === "multiple") {
      props.onToggle(item);
    } else {
      props.onSelect(item);
      setOpen(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <ChevronDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => {
          // let cmdk handle focus on the input itself
          e.preventDefault();
        }}
      >
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={searchPlaceholder} />
          <CommandList className="max-h-72">
            {loading && <div className="text-muted-foreground p-3 text-sm">Loading…</div>}
            {!loading && result?.kind === "error" && (
              <div className="text-destructive p-3 text-sm">{result.message}</div>
            )}
            {!loading && result?.kind === "ok" && visibleItems.length === 0 && (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            )}
            {!loading &&
              visibleItems.length > 0 &&
              visibleItems.map((item) => {
                const key = getKey(item);
                const selected = isSelected(item);
                return (
                  <CommandItem
                    key={key}
                    value={key}
                    onSelect={() => handleSelect(item)}
                    className="cursor-pointer"
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 size-4 shrink-0",
                        selected ? "opacity-100" : "opacity-0",
                        !isMultiple && "text-foreground",
                      )}
                    />
                    <div className="min-w-0 flex-1">{renderItem(item)}</div>
                  </CommandItem>
                );
              })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function filterByText<T>(items: T[], query: string, getText: (item: T) => string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => getText(item).toLowerCase().includes(q));
}
