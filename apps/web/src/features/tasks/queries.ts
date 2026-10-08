import type {
  CreateTaskInput,
  ListResponse,
  ListTasksParams,
  Task,
  UpdateTaskInput,
} from '@tidyr/shared';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { invalidateAfterTaskDelete, invalidateAfterTaskSave } from '@/lib/invalidate';
import { queryKeys } from '@/lib/queryKeys';

export function useTasks(params: ListTasksParams) {
  return useQuery({
    queryKey: queryKeys.tasks.list(params),
    queryFn: () => api.tasks.list(params),
    placeholderData: keepPreviousData,
  });
}

/** Any list that already holds the task, so the drawer opens with data instead of a skeleton. */
function findInLists(queryClient: QueryClient, id: string): Task | undefined {
  for (const [, list] of queryClient.getQueriesData<ListResponse<Task>>({
    queryKey: queryKeys.tasks.all,
  })) {
    const task = list?.data.find((item) => item.id === id);
    if (task) return task;
  }
  return undefined;
}

export function useTask(id: string, enabled = true) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.task(id),
    queryFn: () => api.tasks.get(id),
    enabled,
    placeholderData: () => findInLists(queryClient, id),
  });
}

export function useTaskActivity(id: string) {
  return useQuery({
    queryKey: queryKeys.activity('TASK', id),
    queryFn: () => api.tasks.activity(id, { limit: 20 }),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateTaskInput) => api.tasks.create(body),
    onSuccess: (task) => {
      queryClient.setQueryData(queryKeys.task(task.id), task);
      // Not awaited: the drawer switches to the new task at once while the lists refetch.
      void invalidateAfterTaskSave(queryClient, task);
    },
  });
}

/** False when every field in the patch already has that value (menus re-report the current one). */
export function isChange(task: Task, patch: UpdateTaskInput): boolean {
  return Object.entries(patch).some(
    ([field, value]) => task[field as keyof UpdateTaskInput] !== value,
  );
}

/** The client-side twin of the API's `completedAt` rule (API_CONTRACT §6), for optimistic rows. */
export function applyTaskPatch(task: Task, patch: UpdateTaskInput): Task {
  const next: Task = { ...task, ...patch, updatedAt: new Date().toISOString() };
  if (patch.status === 'COMPLETED') next.completedAt = task.completedAt ?? next.updatedAt;
  else if (patch.status !== undefined) next.completedAt = null;
  return next;
}

const UPDATE_KEY = ['task-update'] as const;

interface UpdateVariables {
  task: Task;
  patch: UpdateTaskInput;
}

interface UpdateContext {
  snapshots: [QueryKey, unknown][];
}

/**
 * PUT with only the changed field, applied to every cached copy first and rolled back with an
 * error toast if it fails (APP_FLOW F7, TECHNICAL_REQUIREMENTS §9).
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation<Task, unknown, UpdateVariables, UpdateContext>({
    mutationKey: UPDATE_KEY,
    mutationFn: ({ task, patch }) => api.tasks.update(task.id, patch),
    onMutate: async ({ task, patch }) => {
      // An in-flight refetch would land after the optimistic write and undo it.
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.tasks.all }),
        queryClient.cancelQueries({ queryKey: queryKeys.task(task.id) }),
      ]);
      const snapshots: [QueryKey, unknown][] = [
        ...queryClient.getQueriesData({ queryKey: queryKeys.tasks.all }),
        [queryKeys.task(task.id), queryClient.getQueryData(queryKeys.task(task.id))],
      ];
      const patchOne = (item: Task) => (item.id === task.id ? applyTaskPatch(item, patch) : item);
      queryClient.setQueriesData<ListResponse<Task>>({ queryKey: queryKeys.tasks.all }, (list) =>
        list ? { ...list, data: list.data.map(patchOne) } : list,
      );
      queryClient.setQueryData<Task>(queryKeys.task(task.id), (current) =>
        current ? patchOne(current) : current,
      );
      return { snapshots };
    },
    onError: (error, { task }, context) => {
      for (const [key, data] of context?.snapshots ?? []) queryClient.setQueryData(key, data);
      toast.error(`Couldn't update ${task.key}. ${errorMessage(error)}`);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.task(saved.id), saved);
    },
    onSettled: (_saved, _error, { task }) => {
      // With several quick changes in flight, refetching after the first would briefly bring
      // back server state the later ones haven't reached yet; the last one to settle refetches.
      if (queryClient.isMutating({ mutationKey: UPDATE_KEY }) > 1) return;
      return invalidateAfterTaskSave(queryClient, task);
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: Task) => api.tasks.remove(task.id),
    // Not awaited, so the drawer closes at once while the lists refetch.
    onSuccess: (_result, task) => void invalidateAfterTaskDelete(queryClient, task),
  });
}
