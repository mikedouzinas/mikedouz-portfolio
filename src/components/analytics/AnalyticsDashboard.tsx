'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Users,
  Clock,
  Zap,
  Globe,
  Smartphone,
  MessageSquare,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface AnalyticsData {
  overview: {
    total_queries: number;
    unique_visitors: number;
    avg_latency_ms: number;
    cache_hit_rate: number;
    date_range: { start: string; end: string };
  };
  geographic: Array<{ country: string; count: number }>;
  devices: Array<{ device: string; count: number }>;
  intents: Array<{ intent: string; count: number }>;
  top_queries: Array<{ query: string; count: number }>;
  time_series: Array<{ date: string; count: number }>;
  conversations: Array<{
    id: string;
    query: string;
    created_at: string;
    visitor_id: string;
    follow_up_count: number;
    follow_ups: Array<{
      id: string;
      query: string;
      created_at: string;
      depth: number;
    }>;
  }>;
}

interface Props {
  data: AnalyticsData;
  days: number;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

const INTENT_COLORS: Record<string, string> = {
  general: '#3b82f6',
  specific_item: '#8b5cf6',
  filter_query: '#ec4899',
  personal: '#f59e0b',
  contact: '#10b981',
};

export default function AnalyticsDashboard({ data, days }: Props) {
  const [expandedConversation, setExpandedConversation] = useState<string | null>(null);

  // Format numbers with commas
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Format cache hit rate as percentage
  const cacheHitRatePercent = Math.round(data.overview.cache_hit_rate * 100);

  // Prepare data for charts
  const intentChartData = data.intents.map((item) => ({
    name: item.intent.replace('_', ' '),
    value: item.count,
    color: INTENT_COLORS[item.intent] || COLORS[0],
  }));

  const deviceChartData = data.devices.map((item, idx) => ({
    name: item.device,
    count: item.count,
    fill: COLORS[idx % COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/60 text-sm">Total Queries</p>
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {formatNumber(data.overview.total_queries)}
          </p>
        </div>

        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/60 text-sm">Unique Visitors</p>
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {formatNumber(data.overview.unique_visitors)}
          </p>
        </div>

        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/60 text-sm">Avg Latency</p>
            <Clock className="w-5 h-5 text-pink-400" />
          </div>
          <p className="text-3xl font-bold text-white">
            {data.overview.avg_latency_ms}ms
          </p>
        </div>

        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white/60 text-sm">Cache Hit Rate</p>
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-white">{cacheHitRatePercent}%</p>
        </div>
      </div>

      {/* Time Series Chart */}
      <div className="bg-white/5 rounded-lg p-6 border border-white/10">
        <h2 className="text-xl font-semibold text-white mb-4">
          Queries Over Time (Last {days} Days)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.time_series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
            <XAxis
              dataKey="date"
              stroke="#ffffff60"
              tick={{ fill: '#ffffff60' }}
            />
            <YAxis stroke="#ffffff60" tick={{ fill: '#ffffff60' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #ffffff20',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            <Legend wrapperStyle={{ color: '#fff' }} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Queries"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Intent and Device Charts Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Intent Distribution */}
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Intent Distribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={intentChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {intentChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #ffffff20',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Device Distribution */}
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Device Types
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={deviceChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis
                dataKey="name"
                stroke="#ffffff60"
                tick={{ fill: '#ffffff60' }}
              />
              <YAxis stroke="#ffffff60" tick={{ fill: '#ffffff60' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #ffffff20',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Bar dataKey="count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Geographic Distribution */}
      {data.geographic.length > 0 && (
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Geographic Distribution
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {data.geographic.slice(0, 10).map((geo) => (
              <div key={geo.country} className="bg-white/5 rounded-lg p-4">
                <p className="text-white font-semibold text-lg">{geo.country}</p>
                <p className="text-white/60 text-sm">
                  {formatNumber(geo.count)} queries
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Queries */}
      <div className="bg-white/5 rounded-lg p-6 border border-white/10">
        <h2 className="text-xl font-semibold text-white mb-4">Top Queries</h2>
        <div className="space-y-2">
          {data.top_queries.map((item, idx) => (
            <div
              key={idx}
              className="bg-white/5 rounded-lg p-4 flex items-center justify-between hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-white/40 font-mono text-sm w-6">
                  {idx + 1}.
                </span>
                <p className="text-white truncate">{item.query}</p>
              </div>
              <span className="text-blue-400 font-semibold ml-4">
                {item.count}x
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Conversation Threads */}
      <div className="bg-white/5 rounded-lg p-6 border border-white/10">
        <h2 className="text-xl font-semibold text-white mb-4">
          Recent Conversations ({data.conversations.length})
        </h2>
        <div className="space-y-3">
          {data.conversations.map((conv) => (
            <div
              key={conv.id}
              className="bg-white/5 rounded-lg p-4 border border-white/10"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{conv.query}</p>
                  <p className="text-white/40 text-sm mt-1">
                    {new Date(conv.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className="text-blue-400 text-sm">
                    {conv.follow_up_count} follow-up{conv.follow_up_count !== 1 ? 's' : ''}
                  </span>
                  {conv.follow_up_count > 0 && (
                    <button
                      onClick={() =>
                        setExpandedConversation(
                          expandedConversation === conv.id ? null : conv.id
                        )
                      }
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      {expandedConversation === conv.id ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Follow-ups (expandable) */}
              {expandedConversation === conv.id && conv.follow_ups.length > 0 && (
                <div className="mt-4 pl-4 border-l-2 border-blue-500/30 space-y-2">
                  {conv.follow_ups.map((followUp, idx) => (
                    <div key={followUp.id} className="bg-white/5 rounded p-3">
                      <p className="text-white/80 text-sm">{followUp.query}</p>
                      <p className="text-white/30 text-xs mt-1">
                        {new Date(followUp.created_at).toLocaleString()} • Depth: {followUp.depth}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
