import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { postMatch, queryClient, errorMessage } from "./api";
import type { MatchRecord, SubmissionState } from "./contracts";
import { read, write } from "./storage";
const inFlight = new Set<string>();
export function useSubmissions() {
  const [pending, setPending] = useState<MatchRecord[]>(() =>
    read<MatchRecord[]>("queue", []),
  );
  const [states, setStates] = useState<Record<string, SubmissionState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mutation = useMutation({ mutationFn: postMatch });
  const { mutateAsync } = mutation;
  const submit = useCallback(
    (record: MatchRecord) => {
      if (inFlight.has(record.id)) return;
      inFlight.add(record.id);
      setStates((old) => ({ ...old, [record.id]: "submitting" }));
      void mutateAsync(record)
        .then(() => {
          const queue = read<MatchRecord[]>("queue", []).filter(
            (r) => r.id !== record.id,
          );
          write("queue", queue);
          setPending(queue);
          setStates((old) => ({ ...old, [record.id]: "confirmed" }));
          setErrors((old) => ({ ...old, [record.id]: "" }));
          void queryClient.invalidateQueries({ queryKey: ["ranking"] });
          void queryClient.invalidateQueries({ queryKey: ["history"] });
        })
        .catch((error) => {
          setStates((old) => ({ ...old, [record.id]: "failed" }));
          setErrors((old) => ({ ...old, [record.id]: errorMessage(error) }));
        })
        .finally(() => inFlight.delete(record.id));
    },
    [mutateAsync],
  );
  useEffect(() => {
    for (const record of read<MatchRecord[]>("queue", [])) submit(record);
  }, [submit]);
  function enqueue(record: MatchRecord) {
    const queue = read<MatchRecord[]>("queue", []);
    if (!queue.some((r) => r.id === record.id)) queue.push(record);
    write("queue", queue);
    write("last-result", record);
    setPending(queue);
    submit(record);
  }
  function status(id: string): SubmissionState {
    return (
      states[id] ?? (pending.some((r) => r.id === id) ? "pending" : "confirmed")
    );
  }
  function reset() {
    setPending([]);
    setStates({});
    setErrors({});
    mutation.reset();
  }
  return { pending, errors, status, enqueue, submit, reset };
}
