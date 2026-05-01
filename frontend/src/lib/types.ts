export type JobStatus = "Đang gán nhãn" | "Đang chờ duyệt" | "Đã được duyệt";

export interface RecordDetail {
  recordId: string;
  worker: string;
  reworkCount: number;
  qa1: string;
  qa2: string;
  kpi: number;
  completedAt?: string;
}

export interface JobPackage {
  jobId: string;
  jobName: string;
  status: JobStatus;
  month: string;
  qa1JobId?: string;
  qa2JobId?: string;
  hiddenUsers?: string[];
  records: RecordDetail[];
}
