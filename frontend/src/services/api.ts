import {
  User,
  StorageDevice,
  StorageProfile,
  RecoveryCase,
  RecoveryCandidate,
  ErasureOperation,
  VerificationResult,
  AuditLog,
  SecurityReport,
  DashboardMetrics,
} from '../types';

const API_BASE = 'http://localhost:8000/api';

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem('datashield_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMsg = 'An unexpected error occurred';
      try {
        const errJson = await response.json();
        errorMsg = errJson.detail || errJson.message || errorMsg;
      } catch {
        errorMsg = `Server error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMsg);
    }

    return response.json();
  }

  // --- Auth ---
  async login(username: string, password: string): Promise<{ access_token: string; user: User }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async getMe(): Promise<{ user: User; permissions: string[] }> {
    return this.request('/auth/me');
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('datashield_token');
      localStorage.removeItem('datashield_user');
    }
  }

  // --- Dashboard ---
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    return this.request('/dashboard/metrics');
  }

  // --- Storage ---
  async getStorageDevices(): Promise<StorageDevice[]> {
    return this.request('/storage/devices');
  }

  async getStorageDevice(id: string): Promise<StorageDevice> {
    return this.request(`/storage/${id}`);
  }

  async analyzeStorage(deviceId: string): Promise<StorageProfile> {
    return this.request('/storage/analyze', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId }),
    });
  }

  // --- Recovery ---
  async getRecoveryCases(): Promise<RecoveryCase[]> {
    return this.request('/recovery/cases');
  }

  async getRecoveryCase(caseId: string): Promise<RecoveryCase> {
    return this.request(`/recovery/cases/${caseId}`);
  }

  async createRecoveryCase(title: string, targetDeviceId: string, notes?: string): Promise<RecoveryCase> {
    return this.request('/recovery/cases', {
      method: 'POST',
      body: JSON.stringify({ title, target_device_id: targetDeviceId, notes }),
    });
  }

  async scanRecoveryCase(caseId: string): Promise<RecoveryCandidate[]> {
    return this.request(`/recovery/cases/${caseId}/scan`, {
      method: 'POST',
    });
  }

  async recoverCandidates(candidateIds: string[]): Promise<RecoveryCandidate[]> {
    return this.request('/recovery/files/recover', {
      method: 'POST',
      body: JSON.stringify({ candidate_ids: candidateIds }),
    });
  }

  // --- Erasure ---
  async analyzeErasure(deviceId: string, targetScope: string = 'FREE_SPACE') {
    return this.request('/erasure/analyze', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId, target_scope: targetScope }),
    });
  }

  async getErasureOperations(): Promise<ErasureOperation[]> {
    return this.request('/erasure/operations');
  }

  async requestErasure(targetDeviceId: string, sanitizationMethod: string, targetScope: string = 'FREE_SPACE', notes?: string): Promise<ErasureOperation> {
    return this.request('/erasure/request', {
      method: 'POST',
      body: JSON.stringify({
        target_device_id: targetDeviceId,
        target_scope: targetScope,
        sanitization_method: sanitizationMethod,
        notes,
      }),
    });
  }

  async approveErasure(operationId: string, notes?: string): Promise<ErasureOperation> {
    return this.request('/erasure/approve', {
      method: 'POST',
      body: JSON.stringify({ operation_id: operationId, approval_notes: notes }),
    });
  }

  async executeErasure(operationId: string, confirmationPhrase: string): Promise<ErasureOperation> {
    return this.request('/erasure/execute', {
      method: 'POST',
      body: JSON.stringify({ operation_id: operationId, confirmation_phrase: confirmationPhrase }),
    });
  }

  // --- Verification ---
  async getVerificationResults(): Promise<VerificationResult[]> {
    return this.request('/verification');
  }

  async startVerification(operationId: string): Promise<VerificationResult> {
    return this.request('/verification/start', {
      method: 'POST',
      body: JSON.stringify({ operation_id: operationId }),
    });
  }

  async getVerification(operationId: string): Promise<VerificationResult> {
    return this.request(`/verification/${operationId}`);
  }

  // --- Audit ---
  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    return this.request(`/audit?limit=${limit}`);
  }

  async exportAuditJson(): Promise<any[]> {
    return this.request('/audit/export/json');
  }

  // --- Reports ---
  async getReports(): Promise<SecurityReport[]> {
    return this.request('/reports');
  }

  async generateErasureReport(operationId: string): Promise<SecurityReport> {
    return this.request(`/reports/erasure/${operationId}/generate`, {
      method: 'POST',
    });
  }

  getReportPdfUrl(reportId: string): string {
    const token = this.getToken();
    return `${API_BASE}/reports/${reportId}/pdf?token=${token}`;
  }

  // --- Users (Admin) ---
  async getUsers(): Promise<User[]> {
    return this.request('/users');
  }

  async createUser(userData: Partial<User> & { password: string }): Promise<User> {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(userId: string): Promise<{ message: string }> {
    return this.request(`/users/${userId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiService();
