"use client";

import { useState } from "react";
import { useLocale, useMessages } from "@/components/locale";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { activeYearPreset, yearPresets } from "@/lib/year-presets";
import { positionForYear, yearAtPosition } from "@/lib/year-scale";

type YearFilterProps = {
  minYear: number | null;
  maxYear: number | null;
  yearScale: number[];
  onChange: (minYear: number | null, maxYear: number | null) => void;
};

const chipClass =
  "h-6 flex-none rounded-full border px-2.5 text-xs font-normal text-muted-foreground shadow-none data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background";

export function YearFilter({ minYear, maxYear, yearScale, onChange }: YearFilterProps) {
  const locale = useLocale();
  const t = useMessages();
  const active = activeYearPreset(minYear, maxYear);
  const [customOpen, setCustomOpen] = useState(active === "custom");
  const showSlider = customOpen || active === "custom";

  // The slider works on ordinal positions so one outlier year takes one step, not most of the track.
  const sliderMin = 0;
  const sliderMax = yearScale.length + 1;
  const minPosition = minYear === null ? sliderMin : (positionForYear(yearScale, minYear) ?? sliderMin);
  const maxPosition = maxYear === null ? sliderMax : (positionForYear(yearScale, maxYear) ?? sliderMax);

  function select(next: string) {
    if (next === "custom") {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    const preset = yearPresets.find((item) => item.id === next);
    // An empty value means the active chip was clicked again: clear the range.
    onChange(preset?.min ?? null, preset?.max ?? null);
  }

  return (
    <div className="grid gap-3">
      <ToggleGroup
        type="single"
        value={showSlider ? "custom" : (active ?? "")}
        onValueChange={select}
        spacing={1}
        aria-label={t.yearAria}
        className="flex w-full flex-wrap justify-start"
      >
        {yearPresets.map((preset) => (
          <ToggleGroupItem key={preset.id} value={preset.id} className={chipClass}>
            {preset.label[locale]}
          </ToggleGroupItem>
        ))}
        <ToggleGroupItem value="custom" className={chipClass}>
          {t.yearCustom}
        </ToggleGroupItem>
      </ToggleGroup>

      {showSlider ? (
        <div className="grid gap-2">
          <Slider
            aria-label={t.yearRangeAria}
            min={sliderMin}
            max={sliderMax}
            step={1}
            minStepsBetweenThumbs={1}
            value={[minPosition, maxPosition]}
            disabled={yearScale.length === 0}
            onValueChange={([minimum, maximum]) =>
              onChange(
                minimum === sliderMin ? null : yearAtPosition(yearScale, minimum),
                maximum === sliderMax ? null : yearAtPosition(yearScale, maximum),
              )
            }
          />
          <div className="flex justify-between text-[11px] text-muted-foreground" aria-hidden="true">
            <span>{t.yearNoMin}</span>
            <span>{t.yearNoMax}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
