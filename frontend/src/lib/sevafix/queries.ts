"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { sevaFixApi } from "./sevafix-api";
import type { ApplicationView, DraftFields, OpenGrievanceInput } from "./sevafix-types";

export const qk = {
  me: ["me"] as const,
  schemes: ["schemes"] as const,
  scheme: (schemeId: string) => ["scheme", schemeId] as const,
  applications: ["applications"] as const,
  application: (appId: string) => ["application", appId] as const,
  sourceChanges: ["sourceChanges"] as const,
  sourceChange: (changeId: string) => ["sourceChange", changeId] as const,
};

export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: sevaFixApi.me });
}

export function useUpdateMe() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: sevaFixApi.updateMe,
    onSuccess: () => client.invalidateQueries({ queryKey: qk.me }),
  });
}

export function useSchemes() {
  return useQuery({ queryKey: qk.schemes, queryFn: sevaFixApi.schemes });
}

export function useScheme(schemeId: string) {
  return useQuery({
    queryKey: qk.scheme(schemeId),
    queryFn: () => sevaFixApi.scheme(schemeId),
    enabled: Boolean(schemeId),
  });
}

export function useApplications() {
  return useQuery({ queryKey: qk.applications, queryFn: sevaFixApi.applications });
}

export function useApplication(appId: string) {
  return useQuery({
    queryKey: qk.application(appId),
    queryFn: () => sevaFixApi.application(appId),
    enabled: Boolean(appId),
  });
}

export function useCreateApplication() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (schemeId: string) => sevaFixApi.createApplication(schemeId),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.applications }),
  });
}

export function useOpenGrievance() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: OpenGrievanceInput) => sevaFixApi.openGrievance(body),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.applications }),
  });
}

export function useSaveDraft(appId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ fields, expectedRevision }: { fields: DraftFields; expectedRevision: number }) =>
      sevaFixApi.saveDraft(appId, fields, expectedRevision),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.application(appId) }),
  });
}

export function useFreezeVersion(appId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => sevaFixApi.freezeVersion(appId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.application(appId) });
      client.invalidateQueries({ queryKey: qk.applications });
    },
  });
}

export function useValidate(appId: string) {
  return useMutation({ mutationFn: () => sevaFixApi.validate(appId) });
}

export function useConfirmDocumentFacts(appId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, facts }: { documentId: string; facts: Record<string, unknown> }) =>
      sevaFixApi.confirmDocumentFacts(appId, documentId, facts),
    onSuccess: (confirmedDocument) => {
      // The mutation response is strongly consistent. Apply it directly so an
      // immediately following DynamoDB query cannot restore the stale
      // NEEDS_USER_CONFIRMATION state while the table catches up.
      client.setQueryData<ApplicationView>(qk.application(appId), (current) =>
        current
          ? {
              ...current,
              documents: current.documents.map((document) =>
                document.documentId === confirmedDocument.documentId ? confirmedDocument : document,
              ),
            }
          : current,
      );
    },
  });
}

export function useDeleteDocument(appId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => sevaFixApi.deleteDocument(documentId),
    onSuccess: (deletedDocument) => {
      client.setQueryData<ApplicationView>(qk.application(appId), (current) =>
        current
          ? {
              ...current,
              documents: current.documents.filter(
                (document) => document.documentId !== deletedDocument.documentId,
              ),
            }
          : current,
      );
    },
  });
}

export function useRecordSubmission(appId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      officialApplicationId,
      submittedAt,
    }: {
      officialApplicationId: string;
      submittedAt: string;
    }) => sevaFixApi.recordSubmission(appId, officialApplicationId, submittedAt),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.application(appId) });
      client.invalidateQueries({ queryKey: qk.applications });
    },
  });
}

export function useAddTimelineEvent(appId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      eventType,
      payload,
      occurredAt,
    }: {
      eventType: string;
      payload?: Record<string, unknown>;
      occurredAt?: string;
    }) => sevaFixApi.addTimelineEvent(appId, eventType, payload, occurredAt),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.application(appId) }),
  });
}

export function useDiagnose(appId: string) {
  return useMutation({
    mutationFn: (body: { reasonText?: string; rejectionDocumentId?: string }) =>
      sevaFixApi.diagnose(appId, body),
  });
}

export function useCreateRepair(appId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (diagnosisId?: string) => sevaFixApi.createRepair(appId, diagnosisId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.application(appId) });
      client.invalidateQueries({ queryKey: qk.applications });
    },
  });
}

export function useRequestAccountDeletion() {
  return useMutation({ mutationFn: sevaFixApi.requestAccountDeletion });
}

export function useSourceChanges() {
  return useQuery({ queryKey: qk.sourceChanges, queryFn: sevaFixApi.sourceChanges });
}

export function useSourceChange(changeId: string) {
  return useQuery({
    queryKey: qk.sourceChange(changeId),
    queryFn: () => sevaFixApi.sourceChange(changeId),
    enabled: Boolean(changeId),
  });
}

export function useApproveSourceChange() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (changeId: string) => sevaFixApi.approveSourceChange(changeId),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.sourceChanges }),
  });
}

export function useRejectSourceChange() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ changeId, reason }: { changeId: string; reason: string }) =>
      sevaFixApi.rejectSourceChange(changeId, reason),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.sourceChanges }),
  });
}

export function usePublishPolicy() {
  return useMutation({
    mutationFn: ({ versionId, body }: { versionId: string; body: Record<string, unknown> }) =>
      sevaFixApi.publishPolicy(versionId, body),
  });
}

export function useRollbackPolicy() {
  return useMutation({
    mutationFn: ({
      versionId,
      schemeId,
      auditReason,
    }: {
      versionId: string;
      schemeId: string;
      auditReason: string;
    }) => sevaFixApi.rollbackPolicy(versionId, schemeId, auditReason),
  });
}
