"use client";

import { useState, useEffect } from "react";

const LAUNCH_DATE = new Date("2026-01-13T00:00:00Z");

function getElapsed() {
  const now = Date.now();
  const diff = now - LAUNCH_DATE.getTime();
  if (diff < 0) return { years: 0, months: 0, days: 0 };

  const launch = new Date(LAUNCH_DATE);
  const current = new Date(now);

  let years = current.getFullYear() - launch.getFullYear();
  let months = current.getMonth() - launch.getMonth();
  let days = current.getDate() - launch.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(current.getFullYear(), current.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  return { years, months, days };
}

export default function UptimeTimer() {
  const [elapsed, setElapsed] = useState(getElapsed);

  useEffect(() => {
    const id = setInterval(() => setElapsed(getElapsed()), 60_000);
    return () => clearInterval(id);
  }, []);

  const parts: string[] = [];
  if (elapsed.years > 0) parts.push(`${elapsed.years} year${elapsed.years !== 1 ? "s" : ""}`);
  if (elapsed.months > 0) parts.push(`${elapsed.months} month${elapsed.months !== 1 ? "s" : ""}`);
  parts.push(`${elapsed.days} day${elapsed.days !== 1 ? "s" : ""}`);

  return (
    <span className="text-cyan-400 font-semibold">{parts.join(", ")}</span>
  );
}
