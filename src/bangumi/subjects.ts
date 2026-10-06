export type SubjectResponse = {
  id: number;
  type?: number;
  name?: string;
  name_cn?: string;
  short_summary?: string;
  summary?: string;
  updated_at?: string;
};

export type SubjectValues = {
  id: number;
  type: number | null;
  title: string | null;
  title_cn: string | null;
  summary: string | null;
  url: string;
  updated_at: number | null;
  last_fetched: number;
  raw: string;
};

export function subjectValues(
  subject: SubjectResponse,
  webBaseUrl: string,
  fetchedAt = Date.now(),
): SubjectValues | null {
  if (!Number.isSafeInteger(subject.id) || subject.id <= 0) return null;

  const updatedAt = subject.updated_at ? Date.parse(subject.updated_at) : NaN;

  return {
    id: subject.id,
    type: Number.isInteger(subject.type) ? (subject.type ?? null) : null,
    title: subject.name ?? null,
    title_cn: subject.name_cn ?? null,
    summary: subject.summary ?? subject.short_summary ?? null,
    url: new URL(`/subject/${subject.id}`, webBaseUrl).toString(),
    updated_at: Number.isFinite(updatedAt) ? updatedAt : null,
    last_fetched: fetchedAt,
    raw: JSON.stringify(subject),
  };
}
