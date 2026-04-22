/**
 * Cron Job Details Page
 * 
 * /dashboard/cron/[id]
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
    fileWatch?: {
      path: string;
      event: string;
      debounceMs: number;
    };
    webhook?: {
      webhookId: string;
      secret: string;
      rateLimit: number;
      ipWhitelist?: string[];
    };
  };
  nextRun?: string;
  lastRun?: string;
  deliver: string;
  deliverTo?: string;
  tags?: string[];
  group?: string;
  permanent?: boolean;
  maxRetries: number;
  retryBackoffMs: number;
  timeoutSeconds: number;
  retryCount?: number;
  createdAt: string;
  createdBy?: string;
  condition?: string;
  dependencies?: string[];
}

interface JobOutput {
  jobId: string;
  jobName: string;
  executedAt: string;
  result: string;
  success: boolean;
  error?: string;
  recovered?: boolean;
  originalScheduledTime?: string;
}

export default function JobDetails({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [job, setJob] = useState<CronJob | null>(null);
  const [outputs, setOutputs] = useState<JobOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'outputs'>('details');

  useEffect(() => {
    fetchJob();
    fetchOutputs();
  }, [params.id]);

  const fetchJob = async () => {
    try {
      const res = await fetch(`/api/cron/jobs/${params.id}`);
      const data = await res.json();

      if (data.success) {
        setJob(data.job);
        setError(null);
      } else {
        setError(data.error || 'Job not found');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOutputs = async () => {
    try {
      const res = await fetch(`/api/cron/jobs/${params.id}/outputs?limit=50`);
      const data = await res.json();

      if (data.success) {
        setOutputs(data.outputs);
      }
    } catch (err: any) {
      console.error('Failed to fetch outputs:', err);
    }
  };

  const handlePause = async () => {
    try {
      const res = await fetch(`/api/cron/jobs/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' })
      });

      const data = await res.json();
      if (data.success) {
        fetchJob();
      }
    } catch (err: any) {
      alert('Failed to pause job: ' + err.message);
    }
  };

  const handleResume = async () => {
    try {
      const res = await fetch(`/api/cron/jobs/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' })
      });

      const data = await res.json();
      if (data.success) {
        fetchJob();
      }
    } catch (err: any) {
      alert('Failed to resume job: ' + err.message);
    }
  };

  const handleTrigger = async () => {
    if (!confirm(`Trigger job "${job?.name}" now?`)) return;

    try {
      const res = await fetch(`/api/cron/jobs/${params.id}/trigger`, {
        method: 'POST'
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setTimeout(fetchOutputs, 2000); // Refresh outputs after 2s
      } else {
        alert('Failed: ' + data.error);
      }
    } catch (err: any) {
      alert('Failed to trigger job: ' + err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete job "${job?.name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/cron/jobs/${params.id}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        router.push('/dashboard/cron');
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const absDiff = Math.abs(diff);
    
    if (absDiff < 60000) return 'just now';
    if (absDiff < 3600000) return `${Math.floor(absDiff / 60000)} minutes ${diff > 0 ? 'from now' : 'ago'}`;
    if (absDiff < 86400000) return `${Math.floor(absDiff / 3600000)} hours ${diff > 0 ? 'from now' : 'ago'}`;
    return `${Math.floor(absDiff / 86400000)} days ${diff > 0 ? 'from now' : 'ago'}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading job...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
            {error || 'Job not found'}
          </div>
          <Link href="/dashboard/cron" className="text-blue-600 hover:underline mt-4 inline-block">
            ← Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/dashboard/cron" className="text-blue-600 hover:underline">
            ← Back to Jobs
          </Link>
          <div className="flex justify-between items-start mt-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">{job.name}</h1>
                <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusBadge(job.status)}`}>
                  {job.status}
                </span>
                {job.permanent && (
                  <span className="px-3 py-1 rounded text-sm font-medium bg-red-100 text-red-800">
                    🔒 Permanent
                  </span>
                )}
              </div>
              <p className="text-gray-600">Job ID: {job.id}</p>
            </div>

            <div className="flex gap-2">
              {job.status === 'active' && (
                <>
                  <button
                    onClick={handleTrigger}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Trigger Now
                  </button>
                  <button
                    onClick={handlePause}
                    className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition"
                  >
                    Pause
                  </button>
                </>
              )}
              
              {job.status === 'paused' && (
                <button
                  onClick={handleResume}
                  className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
                >
                  Resume
                </button>
              )}
              
              {!job.permanent && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'details'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab('outputs')}
                className={`px-6 py-3 font-medium ${
                  activeTab === 'outputs'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Execution History ({outputs.length})
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'details' && (
              <div className="space-y-6">
                {/* Prompt */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Prompt/Task</h3>
                  <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <p className="text-gray-900 whitespace-pre-wrap">{job.prompt}</p>
                  </div>
                </div>

                {/* Trigger Configuration */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Trigger Configuration</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">Type</div>
                      <div className="font-medium text-gray-900 capitalize">{job.trigger.type}</div>
                    </div>

                    {job.trigger.type === 'time' && (
                      <>
                        <div className="bg-gray-50 p-4 rounded border border-gray-200">
                          <div className="text-sm text-gray-600 mb-1">Schedule</div>
                          <div className="font-medium text-gray-900">
                            {job.schedule.description || job.schedule.value}
                          </div>
                        </div>
                        {job.schedule.jitter && job.schedule.jitter > 0 && (
                          <div className="bg-gray-50 p-4 rounded border border-gray-200">
                            <div className="text-sm text-gray-600 mb-1">Jitter</div>
                            <div className="font-medium text-gray-900">±{job.schedule.jitter} minutes</div>
                          </div>
                        )}
                        {job.nextRun && (
                          <div className="bg-gray-50 p-4 rounded border border-gray-200">
                            <div className="text-sm text-gray-600 mb-1">Next Run</div>
                            <div className="font-medium text-gray-900">{formatDate(job.nextRun)}</div>
                            <div className="text-sm text-gray-500 mt-1">{formatRelativeTime(job.nextRun)}</div>
                          </div>
                        )}
                      </>
                    )}
                    {job.condition && (
                      <div className="bg-blue-50 p-4 rounded border border-blue-200 col-span-2">
                        <div className="text-sm text-blue-700 mb-1 font-medium">🔀 Conditional Execution</div>
                        <div className="font-mono text-sm text-blue-900 mb-2">{job.condition}</div>
                        {job.dependencies && job.dependencies.length > 0 && (
                          <div className="text-xs text-blue-600">
                            Dependencies: {job.dependencies.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                    {job.trigger.type === 'file' && job.trigger.fileWatch && (
                      <>
                        <div className="bg-gray-50 p-4 rounded border border-gray-200">
                          <div className="text-sm text-gray-600 mb-1">File Path</div>
                          <div className="font-medium text-gray-900 font-mono text-sm break-all">
                            {job.trigger.fileWatch.path}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded border border-gray-200">
                          <div className="text-sm text-gray-600 mb-1">Event</div>
                          <div className="font-medium text-gray-900 capitalize">
                            {job.trigger.fileWatch.event}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded border border-gray-200">
                          <div className="text-sm text-gray-600 mb-1">Debounce</div>
                          <div className="font-medium text-gray-900">
                            {job.trigger.fileWatch.debounceMs}ms
                          </div>
                        </div>
                      </>
                    )}

                    {job.trigger.type === 'webhook' && job.trigger.webhook && (
                      <>
                        <div className="bg-gray-50 p-4 rounded border border-gray-200">
                          <div className="text-sm text-gray-600 mb-1">Webhook ID</div>
                          <div className="font-medium text-gray-900 font-mono text-sm">
                            {job.trigger.webhook.webhookId}
                          </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded border border-gray-200">
                          <div className="text-sm text-gray-600 mb-1">Rate Limit</div>
                          <div className="font-medium text-gray-900">
                            {job.trigger.webhook.rateLimit} req/min
                          </div>
                        </div>
                        {job.trigger.webhook.ipWhitelist && (
                          <div className="bg-gray-50 p-4 rounded border border-gray-200 col-span-2">
                            <div className="text-sm text-gray-600 mb-1">IP Whitelist</div>
                            <div className="font-medium text-gray-900 font-mono text-sm">
                              {job.trigger.webhook.ipWhitelist.join(', ')}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {job.lastRun && (
                      <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">Last Run</div>
                        <div className="font-medium text-gray-900">{formatDate(job.lastRun)}</div>
                        <div className="text-sm text-gray-500 mt-1">{formatRelativeTime(job.lastRun)}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delivery */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Delivery</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">Channel</div>
                      <div className="font-medium text-gray-900 capitalize">{job.deliver}</div>
                    </div>
                    {job.deliverTo && (
                      <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">Target</div>
                        <div className="font-medium text-gray-900">{job.deliverTo}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Settings */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Settings</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">Max Retries</div>
                      <div className="font-medium text-gray-900">{job.maxRetries}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">Retry Backoff</div>
                      <div className="font-medium text-gray-900">{job.retryBackoffMs / 1000}s</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">Timeout</div>
                      <div className="font-medium text-gray-900">{job.timeoutSeconds}s</div>
                    </div>
                  </div>
                </div>

                {/* Tags & Group */}
                {(job.tags || job.group) && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Organization</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {job.group && (
                        <div className="bg-gray-50 p-4 rounded border border-gray-200">
                          <div className="text-sm text-gray-600 mb-1">Group</div>
                          <div className="font-medium text-gray-900">{job.group}</div>
                        </div>
                      )}
                      {job.tags && job.tags.length > 0 && (
                        <div className="bg-gray-50 p-4 rounded border border-gray-200">
                          <div className="text-sm text-gray-600 mb-2">Tags</div>
                          <div className="flex flex-wrap gap-2">
                            {job.tags.map(tag => (
                              <span key={tag} className="px-2 py-1 bg-white text-gray-700 rounded text-xs border">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Metadata</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                      <div className="text-sm text-gray-600 mb-1">Created At</div>
                      <div className="font-medium text-gray-900">{formatDate(job.createdAt)}</div>
                    </div>
                    {job.createdBy && (
                      <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <div className="text-sm text-gray-600 mb-1">Created By</div>
                        <div className="font-medium text-gray-900">{job.createdBy}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'outputs' && (
              <div className="space-y-4">
                {outputs.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-5xl mb-3">📋</div>
                    <p className="text-gray-600">No executions yet</p>
                  </div>
                ) : (
                  outputs.map((output, index) => (
                    <div
                      key={index}
                      className={`border rounded-lg p-4 ${
                        output.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-lg ${output.success ? '✅' : '❌'}`}>
                              {output.success ? '✅' : '❌'}
                            </span>
                            <span className="font-medium text-gray-900">
                              {formatDate(output.executedAt)}
                            </span>
                            {output.recovered && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                🔄 Recovered
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatRelativeTime(output.executedAt)}
                          </div>
                        </div>
                      </div>

                      {output.originalScheduledTime && (
                        <div className="text-sm text-gray-600 mb-2">
                          Originally scheduled: {formatDate(output.originalScheduledTime)}
                        </div>
                      )}

                      {output.error && (
                        <div className="bg-white border border-red-300 rounded p-3 mb-2">
                          <div className="text-sm font-medium text-red-900 mb-1">Error:</div>
                          <div className="text-sm text-red-700 font-mono">{output.error}</div>
                        </div>
                      )}

                      <div className="bg-white border border-gray-200 rounded p-3">
                        <div className="text-sm text-gray-900 whitespace-pre-wrap font-mono">
                          {output.result.substring(0, 500)}
                          {output.result.length > 500 && '...'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
