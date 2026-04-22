/**
 * Cron Jobs Dashboard - Main Page
 * 
 * /dashboard/cron
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface CronJob {
  id: string;
  name: string;
  prompt: string;
  status: 'active' | 'paused' | 'disabled';
  schedule: {
    type: string;
    value: string;
    description?: string;
    jitter?: number;
  };
  trigger: {
    type: 'time' | 'file' | 'webhook';
  };
  nextRun?: string;
  deliver: string;
  tags?: string[];
  group?: string;
  permanent?: boolean;
  createdAt: string;
}

export default function CronDashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');

  // Available groups (extracted from jobs)
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);

  useEffect(() => {
    fetchJobs();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, [statusFilter, groupFilter, searchTerm]);

  const fetchJobs = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (groupFilter !== 'all') params.append('group', groupFilter);
      if (searchTerm) params.append('search', searchTerm);

      const res = await fetch(`/api/cron/jobs?${params}`);
      const data = await res.json();

      if (data.success) {
        setJobs(data.jobs);
        
        // Extract unique groups
        const groups = Array.from(new Set(data.jobs.map((j: CronJob) => j.group).filter(Boolean))) as string[];
        setAvailableGroups(groups);
        
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch jobs');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (jobId: string) => {
    try {
      const res = await fetch(`/api/cron/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' })
      });

      const data = await res.json();
      if (data.success) {
        fetchJobs();
      }
    } catch (err: any) {
      alert('Failed to pause job: ' + err.message);
    }
  };

  const handleResume = async (jobId: string) => {
    try {
      const res = await fetch(`/api/cron/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' })
      });

      const data = await res.json();
      if (data.success) {
        fetchJobs();
      }
    } catch (err: any) {
      alert('Failed to resume job: ' + err.message);
    }
  };

  const handleTrigger = async (jobId: string, jobName: string) => {
    if (!confirm(`Trigger job "${jobName}" now?`)) return;

    try {
      const res = await fetch(`/api/cron/jobs/${jobId}/trigger`, {
        method: 'POST'
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message);
      } else {
        alert('Failed: ' + data.error);
      }
    } catch (err: any) {
      alert('Failed to trigger job: ' + err.message);
    }
  };

  const handleDelete = async (jobId: string, jobName: string) => {
    if (!confirm(`Delete job "${jobName}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/cron/jobs/${jobId}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        fetchJobs();
      } else {
        alert('Failed: ' + data.error);
      }
    } catch (err: any) {
      alert('Failed to delete job: ' + err.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      disabled: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || colors.disabled;
  };

  const getTriggerBadge = (type: string) => {
    const colors = {
      time: 'bg-blue-100 text-blue-800',
      file: 'bg-purple-100 text-purple-800',
      webhook: 'bg-orange-100 text-orange-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatNextRun = (nextRun?: string) => {
    if (!nextRun) return 'N/A';
    const date = new Date(nextRun);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    
    if (diff < 0) return 'Overdue';
    if (diff < 60000) return 'Less than 1 minute';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours`;
    return `${Math.floor(diff / 86400000)} days`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading jobs...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Cron Jobs</h1>
              <p className="text-gray-600 mt-1">Manage scheduled tasks and automations</p>
            </div>
            <Link
              href="/dashboard/cron/new"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              + New Job
            </Link>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="disabled">Disabled</option>
            </select>

            {availableGroups.length > 0 && (
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Groups</option>
                {availableGroups.map(group => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            )}

            <button
              onClick={fetchJobs}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Total Jobs</div>
            <div className="text-2xl font-bold text-gray-900">{jobs.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Active</div>
            <div className="text-2xl font-bold text-green-600">
              {jobs.filter(j => j.status === 'active').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Paused</div>
            <div className="text-2xl font-bold text-yellow-600">
              {jobs.filter(j => j.status === 'paused').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Disabled</div>
            <div className="text-2xl font-bold text-gray-600">
              {jobs.filter(j => j.status === 'disabled').length}
            </div>
          </div>
        </div>

        {/* Jobs List */}
        {jobs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📅</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No jobs found</h3>
            <p className="text-gray-500 mb-6">Create your first scheduled job to get started</p>
            <Link
              href="/dashboard/cron/new"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Create Job
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map(job => (
              <div key={job.id} className="bg-white rounded-lg shadow hover:shadow-md transition">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{job.name}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(job.status)}`}>
                          {job.status}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getTriggerBadge(job.trigger.type)}`}>
                          {job.trigger.type}
                        </span>
                        {job.permanent && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                            🔒 Permanent
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{job.prompt}</p>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <div>
                          <span className="font-medium">Schedule:</span> {job.schedule.description || job.schedule.value}
                          {job.schedule.jitter && ` (±${job.schedule.jitter}min)`}
                        </div>
                        {job.trigger.type === 'time' && job.nextRun && (
                          <div>
                            <span className="font-medium">Next run:</span> {formatNextRun(job.nextRun)}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Deliver:</span> {job.deliver}
                        </div>
                        {job.group && (
                          <div>
                            <span className="font-medium">Group:</span> {job.group}
                          </div>
                        )}
                      </div>

                      {job.tags && job.tags.length > 0 && (
                        <div className="flex gap-2 mt-3">
                          {job.tags.map(tag => (
                            <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 ml-4">
                      <Link
                        href={`/dashboard/cron/${job.id}`}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition text-sm"
                      >
                        Details
                      </Link>
                      
                      {job.status === 'active' && (
                        <>
                          <button
                            onClick={() => handleTrigger(job.id, job.name)}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition text-sm"
                          >
                            Trigger
                          </button>
                          <button
                            onClick={() => handlePause(job.id)}
                            className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition text-sm"
                          >
                            Pause
                          </button>
                        </>
                      )}
                      
                      {job.status === 'paused' && (
                        <button
                          onClick={() => handleResume(job.id)}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition text-sm"
                        >
                          Resume
                        </button>
                      )}
                      
                      {!job.permanent && (
                        <button
                          onClick={() => handleDelete(job.id, job.name)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition text-sm"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
