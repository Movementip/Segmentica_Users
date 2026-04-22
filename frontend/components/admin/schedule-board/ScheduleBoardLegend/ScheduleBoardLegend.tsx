import React from "react";

import { cn } from "@/lib/utils";

import { SCHEDULE_LEGEND_ITEMS } from "../model";
import styles from "./ScheduleBoardLegend.module.css";

export function ScheduleBoardLegend() {
  return (
    <div className={styles.legend}>
      {SCHEDULE_LEGEND_ITEMS.map((item) => (
        <span key={item.tone} className={cn(styles.item, styles[item.tone])}>
          {item.label}
        </span>
      ))}
    </div>
  );
}
