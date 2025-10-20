import { create } from 'zustand';
import { ProcessingJob, ProcessingStatus } from '../types';
import { uploadService } from '../services/api';

interface UploadStore {
  currentJob: ProcessingJob | null;
  uploadHistory: ProcessingJob[];
  isLoading: boolean;
  
  uploadFile: (file: File) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
  retryJob: (jobId: string) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  fetchJobStatus: (jobId: string) => Promise<void>;
  fetchUploadHistory: () => Promise<void>;
  setCurrentJob: (job: ProcessingJob | null) => void;
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  currentJob: null,
  uploadHistory: [],
  isLoading: false,

  uploadFile: async (file: File) => {
    set({ isLoading: true });
    try {
      const job = await uploadService.uploadFile(file) as ProcessingJob;
      set({
        currentJob: job,
        isLoading: false,
      });
      
      // Start polling for job status
      const pollInterval = setInterval(async () => {
        try {
          await get().fetchJobStatus(job.id);
          const currentJob = get().currentJob;
          if (currentJob && (currentJob.status === 'completed' || currentJob.status === 'failed')) {
            clearInterval(pollInterval);
            await get().fetchUploadHistory(); // Refresh history
          }
        } catch (error) {
          console.error('Error polling job status:', error);
          clearInterval(pollInterval);
        }
      }, 2000); // Poll every 2 seconds

    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  cancelJob: async (jobId: string) => {
    try {
      await uploadService.cancelUpload(jobId);
      const { currentJob } = get();
      if (currentJob && currentJob.id === jobId) {
        set({
          currentJob: { ...currentJob, status: ProcessingStatus.FAILED },
        });
      }
      await get().fetchUploadHistory();
    } catch (error) {
      console.error('Error canceling job:', error);
      throw error;
    }
  },

  retryJob: async (_jobId: string) => {
    try {
      // Note: retryJob would need to be implemented in UploadService
      throw new Error('Retry job not implemented');
    } catch (error) {
      console.error('Error retrying job:', error);
      throw error;
    }
  },

  deleteJob: async (jobId: string) => {
    try {
      await uploadService.deleteUpload(jobId);
      const { currentJob, uploadHistory } = get();
      
      if (currentJob && currentJob.id === jobId) {
        set({ currentJob: null });
      }
      
      set({
        uploadHistory: uploadHistory.filter(job => job.id !== jobId),
      });
    } catch (error) {
      console.error('Error deleting job:', error);
      throw error;
    }
  },

  fetchJobStatus: async (jobId: string) => {
    try {
      const job = await uploadService.getUploadProgress(jobId) as ProcessingJob;
      const { currentJob } = get();
      
      if (currentJob && currentJob.id === jobId) {
        set({ currentJob: job });
      }
      
      // Update in history as well
      const { uploadHistory } = get();
      const updatedHistory = uploadHistory.map(j => 
        j.id === jobId ? job : j
      );
      set({ uploadHistory: updatedHistory });
    } catch (error) {
      console.error('Error fetching job status:', error);
      throw error;
    }
  },

  fetchUploadHistory: async () => {
    set({ isLoading: true });
    try {
      const response = await uploadService.getUploads();
      set({
        uploadHistory: (response as any)?.data || [],
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      console.error('Error fetching upload history:', error);
    }
  },

  setCurrentJob: (job: ProcessingJob | null) => {
    set({ currentJob: job });
  },
}));