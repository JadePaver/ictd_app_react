import { FormField, TextInput } from "../../components/ui/FormField";
import { Spinner } from "../../components/ui/Spinner";
import { CheckIcon } from "../../components/ui/icons";
import type { useMrNumber } from "./useMrNumber";

export const MR_NUMBER_TAKEN = "An MR with this number already exists";

/** The MR number input shared by the Issue and Transfer forms. See useMrNumber. */
export function MrNumberField({
  id,
  label = "MR number",
  number,
  error,
}: {
  id: string;
  label?: string;
  number: ReturnType<typeof useMrNumber>;
  /** The form's own error (empty number), shown once it has been submitted. */
  error?: string;
}) {
  const isSuggested = !!number.suggested && number.value === number.suggested;
  const typed = number.edited && !!number.value.trim();
  return (
    <div className="flex flex-col gap-1.5">
      <FormField
        label={label}
        htmlFor={id}
        required
        error={error ?? (number.takenBy ? MR_NUMBER_TAKEN : undefined)}
        hint={isSuggested ? "Next in sequence. You can change it." : "Must be unique. Letter case doesn't matter."}
      >
        <TextInput
          mono
          trailing={
            number.checking ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : typed && !number.takenBy ? (
              <CheckIcon size={14} className="text-good" />
            ) : null
          }
          value={number.value}
          onChange={(e) => number.set(e.target.value)}
          placeholder="e.g. MR-2026-0007"
          autoComplete="off"
          spellCheck={false}
        />
      </FormField>
      {/* After the error, so "already exists" is followed by the way out. */}
      {!isSuggested && number.suggested ? (
        <button
          type="button"
          onClick={number.useSuggested}
          className="self-start rounded-md px-1.5 py-0.5 text-xs font-medium text-series-1 hover:bg-series-1/10"
        >
          Use the next free number, <span className="font-mono">{number.suggested}</span>
        </button>
      ) : null}
    </div>
  );
}
