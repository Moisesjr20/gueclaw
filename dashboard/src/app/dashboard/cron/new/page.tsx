/**
 * Create New Cron Job Page
 * 
 * /dashboard/cron/new
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type TriggerType = 'time' | 'file' | 'webhook';
type DeliveryTarget = 'telegram' | 'whatsapp' | 'email' | 'webhook' | 'discord';

export default function NewCronJob() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webhookInfo, setWebhookInfo] = useState<{
    webhookId: string;
    secret: string;
    webhookUrl: string;
  } | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('time');
  
  // Time trigger fields
  const [schedule, setSchedule] = useState('0 9 * * *');
  const [jitter, setJitter] = useState(0);
  
  // File trigger fields
  const [filePath, setFilePath] = useState('');
  const [fileEvent, setFileEvent] = useState<'created' | 'modified' | 'deleted' | 'all'>('all');
  
  // Webhook trigger fields
  const [webhookRateLimit, setWebhookRateLimit] = useState(10);
  const [webhookIpWhitelist, setWebhookIpWhitelist] = useState('');
  
  // Delivery
  const [deliver, setDeliver] = useState<DeliveryTarget>('telegram');
  const [deliverTo, setDeliverTo] = useState('');
  
  // Optional fields
  const [tags, setTags] = useState('');
  const [group, setGroup] = useState('');
  const [maxRetries, setMaxRetries] = useState(0);
  const [timeoutSeconds, setTimeoutSeconds] = useState(300);
  const [condition, setCondition] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setWebhookInfo(null);

    try {
      const body: any = {
        name,
        prompt,
        triggerType,
        deliver,
        deliverTo: deliverTo || undefined,
        tags: tags ? tags.split(',').map(t => t.trim()) : undefined,
        group: group || undefined,
        maxRetries,
        timeoutSeconds,
        condition: condition || undefined,
        userId: 'dashboard-user' // TODO: Get from auth
      };

      if (triggerType === 'time') {
        body.schedule = schedule;
        if (jitter > 0) body.jitter = jitter;
      } else if (triggerType === 'file') {
        body.filePath = filePath;
        body.fileEvent = fileEvent;
      } else if (triggerType === 'webhook') {
        body.webhookRateLimit = webhookRateLimit;
        if (webhookIpWhitelist) {
          body.webhookIpWhitelist = webhookIpWhitelist.split(',').map(ip => ip.trim());
        }
      }

      const res = await fetch('/api/cron/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (data.success) {
        if (data.webhookId) {
          // Show webhook details
          setWebhookInfo({
            webhookId: data.webhookId,
            secret: data.secret,
            webhookUrl: data.webhookUrl
          });
        } else {
          // Redirect to jobs list
          router.push('/dashboard/cron');
        }
      } else {
        setError(data.error || 'Failed to create job');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const scheduleExamples = [
    { label: 'Every 30 minutes', value: '30m' },
    { label: 'Every hour', value: '1h' },
    { label: 'Every day at 9 AM', value: '0 9 * * *' },
    { label: 'Every Monday at 8 AM', value: '0 8 * * 1' },
    { label: 'Every 15 minutes', value: '*/15 * * * *' }
  ];

  if (webhookInfo) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center mb-6">
              <div className="text-green-600 text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Webhook Job Created!</h2>
              <p className="text-gray-600">Save these credentials - they won't be shown again</p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
                <div className="bg-gray-50 p-3 rounded border border-gray-200 font-mono text-sm break-all">
                  {webhookInfo.webhookUrl}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Webhook ID</label>
                <div className="bg-gray-50 p-3 rounded border border-gray-200 font-mono text-sm">
                  {webhookInfo.webhookId}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Secret (for HMAC signature)</label>
                <div className="bg-gray-50 p-3 rounded border border-gray-200 font-mono text-sm break-all">
                  {webhookInfo.secret}
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-6">
              <h3 className="font-semibold text-blue-900 mb-2">Example cURL Request</h3>
              <pre className="text-xs bg-white p-3 rounded border border-blue-200 overflow-x-auto">
{`curl -X POST ${webhookInfo.webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Signature: <HMAC-SHA256>" \\
  -d '{"test": "data"}'`}
              </pre>
            </div>

            <div className="flex gap-4">
              <Link
                href="/dashboard/cron"
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition text-center"
              >
                Go to Jobs List
              </Link>
              <button
                onClick={() => {
                  setWebhookInfo(null);
                  setName('');
                  setPrompt('');
                }}
                className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition"
              >
                Create Another Job
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard/cron" className="text-blue-600 hover:underline">
            ← Back to Jobs
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Create New Cron Job</h1>
          <p className="text-gray-600 mt-1">Schedule automated tasks and workflows</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow">
          <div className="p-6 space-y-6">
            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Basic Info */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g., Daily Report Generator"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt/Task <span className="text-red-500">*</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
                rows={4}
                placeholder="Describe what this job should do..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Trigger Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Trigger Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-4">
                {(['time', 'file', 'webhook'] as TriggerType[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTriggerType(type)}
                    className={`p-4 rounded-lg border-2 transition ${
                      triggerType === type
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">
                      {type === 'time' && '⏰'}
                      {type === 'file' && '📁'}
                      {type === 'webhook' && '🔗'}
                    </div>
                    <div className="font-medium capitalize">{type}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Trigger Fields */}
            {triggerType === 'time' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    required
                    placeholder="0 9 * * * or 30m or 2h"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                  />
                  <div className="flex flex-wrap gap-2">
                    {scheduleExamples.map(ex => (
                      <button
                        key={ex.value}
                        type="button"
                        onClick={() => setSchedule(ex.value)}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jitter (minutes)
                  </label>
                  <input
                    type="number"
                    value={jitter}
                    onChange={(e) => setJitter(parseInt(e.target.value) || 0)}
                    min="0"
                    placeholder="0 = no jitter"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Add random offset (±N minutes) to distribute load
                  </p>
                </div>
              </>
            )}

            {/* File Trigger Fields */}
            {triggerType === 'file' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    File Path (glob pattern) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    required
                    placeholder="/path/to/watch/*.txt"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    File Event
                  </label>
                  <select
                    value={fileEvent}
                    onChange={(e) => setFileEvent(e.target.value as any)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All events</option>
                    <option value="created">File created</option>
                    <option value="modified">File modified</option>
                    <option value="deleted">File deleted</option>
                  </select>
                </div>
              </>
            )}

            {/* Webhook Trigger Fields */}
            {triggerType === 'webhook' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rate Limit (requests/minute)
                  </label>
                  <input
                    type="number"
                    value={webhookRateLimit}
                    onChange={(e) => setWebhookRateLimit(parseInt(e.target.value) || 10)}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    IP Whitelist (optional, comma-separated)
                  </label>
                  <input
                    type="text"
                    value={webhookIpWhitelist}
                    onChange={(e) => setWebhookIpWhitelist(e.target.value)}
                    placeholder="192.168.1.1, 10.0.0.1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {/* Delivery */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Channel <span className="text-red-500">*</span>
              </label>
              <select
                value={deliver}
                onChange={(e) => setDeliver(e.target.value as DeliveryTarget)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="telegram">Telegram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="webhook">Webhook</option>
                <option value="discord">Discord</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Target (optional)
              </label>
              <input
                type="text"
                value={deliverTo}
                onChange={(e) => setDeliverTo(e.target.value)}
                placeholder="Chat ID, phone number, email, etc."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Conditional Execution */}
            {triggerType === 'time' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Condition (optional)
                </label>
                <input
                  type="text"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  placeholder='e.g., job:abc123.success OR age(xyz789) > 1h'
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Only run if condition passes. Examples:
                </p>
                <ul className="text-xs text-gray-500 mt-1 list-disc ml-5">
                  <li><code className="bg-gray-100 px-1 rounded">job:abc123.success</code> - Depends on job success</li>
                  <li><code className="bg-gray-100 px-1 rounded">job:abc.success AND job:xyz.success</code> - Both must succeed</li>
                  <li><code className="bg-gray-100 px-1 rounded">job:abc.lastRun &lt; 2h</code> - Job ran less than 2h ago</li>
                  <li><code className="bg-gray-100 px-1 rounded">age(abc123) &gt; 1h</code> - Time since last run</li>
                </ul>
              </div>
            )}

            {/* Optional Fields */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Optional Settings</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="reports, daily, important"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Group
                  </label>
                  <input
                    type="text"
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    placeholder="analytics"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Retries
                  </label>
                  <input
                    type="number"
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(parseInt(e.target.value) || 0)}
                    min="0"
                    max="5"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Timeout (seconds)
                  </label>
                  <input
                    type="number"
                    value={timeoutSeconds}
                    onChange={(e) => setTimeoutSeconds(parseInt(e.target.value) || 300)}
                    min="10"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-end gap-4">
            <Link
              href="/dashboard/cron"
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
