"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tag } from "lucide-react";

interface BulkCategorySelectProps {
  categories: Array<{ id: string; name: string; parentId: string | null }>;
  onBulkSelect: (categoryId: string) => void;
}

export function BulkCategorySelect({
  categories,
  onBulkSelect,
}: BulkCategorySelectProps) {
  const [value, setValue] = useState<string>("");

  const handleChange = (v: string | null) => {
    if (v) {
      setValue(v);
      onBulkSelect(v);
    }
  };

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="h-7 text-xs border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50/50 dark:bg-gray-900/50 gap-1.5">
        <Tag className="size-3 text-gray-400 shrink-0" />
        <SelectValue placeholder="Bulk assign category">
          {() => {
            if (!value) return "Bulk assign category";
            const cat = categories.find((c) => c.id === value);
            return cat?.name ?? value;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {categories.map((cat) => (
          <SelectItem key={cat.id} value={cat.id}>
            {cat.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
