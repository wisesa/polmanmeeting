"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, type ChangeEvent } from "react";

export default function MeetingDateFilter({
  selectedDate,
  todayDate,
  selectedLabel,
  filteredCount,
  totalCount
}: {
  selectedDate: string;
  todayDate: string;
  selectedLabel: string;
  filteredCount: number;
  totalCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setDate(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", value || todayDate);
    startTransition(() => router.replace(`/?${params.toString()}`));
  }

  function goToday() {
    setDate(todayDate);
  }

  return (
    <section className="filterCard">
      <div className="filterCopy">
        <span className="filterIcon" aria-hidden="true">📅</span>
        <div>
          <p className="eyebrow">Filter Tanggal Meeting</p>
          <h2>{selectedLabel}</h2>
          <p className="muted">
            Menampilkan {filteredCount} meeting dari total {totalCount} meeting di Firebase.
          </p>
        </div>
      </div>

      <div className="filterControls">
        <label className="dateInputLabel">
          <span>Tanggal</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setDate(event.target.value)}
            aria-label="Pilih tanggal meeting"
          />
        </label>
        <button className="ghostButton" type="button" onClick={goToday} disabled={selectedDate === todayDate || isPending}>
          Hari Ini
        </button>
      </div>
    </section>
  );
}
