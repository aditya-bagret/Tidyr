import type { CreateProjectInput, ListProjectsParams, UpdateProjectInput } from '@tidyr/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { invalidateAfterProjectDelete, invalidateAfterProjectSave } from '@/lib/invalidate';
import { queryKeys } from '@/lib/queryKeys';

export function useProjects(params: ListProjectsParams) {
  return useQuery({
    queryKey: queryKeys.projects.list(params),
    queryFn: () => api.projects.list(params),
    // Paging and filtering keep the current cards on screen (with the refetch bar) until the
    // next page arrives, instead of flashing skeletons.
    placeholderData: keepPreviousData,
  });
}

export function useProject(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.project(id),
    queryFn: () => api.projects.get(id),
    enabled,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProjectInput) => api.projects.create(body),
    onSuccess: (project) => invalidateAfterProjectSave(queryClient, project.id),
  });
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProjectInput) => api.projects.update(id, body),
    onSuccess: () => invalidateAfterProjectSave(queryClient, id),
  });
}

export function useDeleteProject(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.projects.remove(id),
    onSuccess: () => invalidateAfterProjectDelete(queryClient, id),
  });
}
