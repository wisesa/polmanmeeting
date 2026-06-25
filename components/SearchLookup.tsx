"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type LookupOption = {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
};

type SearchableSelectProps = {
  name: string;
  options: LookupOption[];
  value?: string;
  placeholder?: string;
  emptyText?: string;
  fallbackLabel?: string;
  disabled?: boolean;
  required?: boolean;
};

type SearchableMultiSelectProps = {
  name: string;
  options: LookupOption[];
  values?: string[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function optionMatches(option: LookupOption, query: string) {
  const q = normalize(query);
  if (!q) return true;

  const text = normalize([
    option.label,
    option.description,
    option.searchText,
    option.value,
  ].filter(Boolean).join(" "));

  return text.includes(q);
}

export function SearchableSelect({
  name,
  options,
  value = "",
  placeholder = "Cari dan pilih data",
  emptyText = "Data tidak ditemukan",
  fallbackLabel,
  disabled = false,
  required = false,
}: SearchableSelectProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedValue, setSelectedValue] = useState(value || "");

  useEffect(() => {
    setSelectedValue(value || "");
    setQuery("");
  }, [value]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedOption = options.find((option) => option.value === selectedValue);
  const filteredOptions = useMemo(
    () => options.filter((option) => optionMatches(option, query)).slice(0, 50),
    [options, query]
  );

  const displayLabel = selectedOption?.label || fallbackLabel || "";

  return (
    <div className="lookupControl" ref={wrapperRef}>
      <input type="hidden" name={name} value={selectedValue} required={required} />

      <button
        type="button"
        className={selectedValue ? "lookupButton hasValue" : "lookupButton"}
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
      >
        <span>{displayLabel || placeholder}</span>
        <span className="lookupChevron" aria-hidden="true">⌄</span>
      </button>

      {open ? (
        <div className="lookupPopover">
          <input
            className="lookupSearchInput"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ketik untuk mencari..."
            autoFocus
          />

          <div className="lookupOptions" role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="lookupEmpty">{emptyText}</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={option.value === selectedValue ? "lookupOption selected" : "lookupOption"}
                  onClick={() => {
                    setSelectedValue(option.value);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <strong>{option.label}</strong>
                  {option.description ? <span>{option.description}</span> : null}
                </button>
              ))
            )}
          </div>

          {selectedValue ? (
            <button
              type="button"
              className="lookupClearButton"
              onClick={() => {
                setSelectedValue("");
                setQuery("");
                setOpen(false);
              }}
            >
              Hapus pilihan
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SearchableMultiSelect({
  name,
  options,
  values = [],
  placeholder = "Cari lalu pilih satu atau lebih data",
  emptyText = "Data tidak ditemukan",
  disabled = false,
}: SearchableMultiSelectProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedValues, setSelectedValues] = useState<string[]>(values.filter(Boolean));

  useEffect(() => {
    setSelectedValues(values.filter(Boolean));
    setQuery("");
  }, [values.join("|")]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const selectedOptions = selectedValues
    .map((selectedValue) => options.find((option) => option.value === selectedValue))
    .filter((option): option is LookupOption => Boolean(option));

  const filteredOptions = useMemo(
    () => options.filter((option) => !selectedSet.has(option.value) && optionMatches(option, query)).slice(0, 50),
    [options, query, selectedSet]
  );

  function addValue(nextValue: string) {
    setSelectedValues((current) => current.includes(nextValue) ? current : [...current, nextValue]);
    setQuery("");
  }

  function removeValue(nextValue: string) {
    setSelectedValues((current) => current.filter((item) => item !== nextValue));
  }

  return (
    <div className="lookupControl multiLookup" ref={wrapperRef}>
      {selectedValues.map((selectedValue) => (
        <input key={selectedValue} type="hidden" name={name} value={selectedValue} />
      ))}

      <button
        type="button"
        className={selectedValues.length > 0 ? "lookupButton hasValue multi" : "lookupButton multi"}
        onClick={() => !disabled && setOpen((current) => !current)}
        disabled={disabled}
      >
        <span>{selectedValues.length > 0 ? `${selectedValues.length} prodi dipilih` : placeholder}</span>
        <span className="lookupChevron" aria-hidden="true">⌄</span>
      </button>

      {selectedOptions.length > 0 ? (
        <div className="lookupTags">
          {selectedOptions.map((option) => (
            <span key={option.value} className="lookupTag">
              {option.label}
              <button type="button" onClick={() => removeValue(option.value)} aria-label={`Hapus ${option.label}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {open ? (
        <div className="lookupPopover">
          <input
            className="lookupSearchInput"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ketik nama atau kode prodi..."
            autoFocus
          />

          <div className="lookupOptions" role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="lookupEmpty">{emptyText}</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="lookupOption"
                  onClick={() => addValue(option.value)}
                >
                  <strong>{option.label}</strong>
                  {option.description ? <span>{option.description}</span> : null}
                </button>
              ))
            )}
          </div>

          {selectedValues.length > 0 ? (
            <button
              type="button"
              className="lookupClearButton"
              onClick={() => {
                setSelectedValues([]);
                setQuery("");
                setOpen(false);
              }}
            >
              Hapus semua pilihan
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
