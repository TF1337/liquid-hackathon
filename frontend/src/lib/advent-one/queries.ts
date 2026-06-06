import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getFacts,
  getGraph,
  getHealth,
  getState,
  postExtract,
  postSynthesize,
  postTrigger,
} from "./client";
import type { SchemaName, SynthesizeResponse, WorkflowGraph } from "./types";

export const factsQueryOptions = () =>
  queryOptions({
    queryKey: ["facts"] as const,
    queryFn: ({ signal }) => getFacts(signal),
    staleTime: 0,
  });

export const graphQueryOptions = () =>
  queryOptions<WorkflowGraph | null>({
    queryKey: ["graph"] as const,
    queryFn: ({ signal }) => getGraph(signal),
    staleTime: 0,
  });

export const stateQueryOptions = () =>
  queryOptions({
    queryKey: ["state"] as const,
    queryFn: ({ signal }) => getState(signal),
    staleTime: 0,
  });

export const healthQueryOptions = () =>
  queryOptions({
    queryKey: ["health"] as const,
    queryFn: ({ signal }) => getHealth(signal),
    staleTime: 2_000,
    refetchInterval: 5_000,
  });

export function useLiveFacts(enabled: boolean) {
  return useQuery({ ...factsQueryOptions(), enabled });
}

export function useLiveGraph(enabled: boolean) {
  return useQuery({ ...graphQueryOptions(), enabled });
}

export function useLiveState(enabled: boolean) {
  return useQuery({ ...stateQueryOptions(), enabled });
}

export function useLiveHealth(enabled: boolean) {
  return useQuery({ ...healthQueryOptions(), enabled });
}

export function useTriggerMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => postTrigger(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["state"] });
    },
  });
}

export function useExtractMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { file: File | Blob; filename?: string; schema: SchemaName }) =>
      postExtract(args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facts"] });
      qc.invalidateQueries({ queryKey: ["state"] });
    },
  });
}

export function useSynthesizeMutation() {
  const qc = useQueryClient();
  return useMutation<SynthesizeResponse>({
    mutationFn: () => postSynthesize(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["graph"] });
    },
  });
}