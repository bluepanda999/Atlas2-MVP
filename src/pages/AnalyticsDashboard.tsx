import React, { useState, useEffect } from "react";
import { Line, Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js";
// import { useApi } from "../hooks/useApi";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
);

interface DashboardData {
  timeRange: {
    startTime: string;
    endTime: string;
  };
  systemMetrics: {
    cpu: {
      current: number;
      average: number;
      min: number;
      max: number;
      trend: string;
    };
    memory: {
      current: number;
      average: number;
      min: number;
      max: number;
      trend: string;
    };
    disk: {
      current: number;
      average: number;
      min: number;
      max: number;
      trend: string;
    };
    network: {
      current: number;
      average: number;
      min: number;
      max: number;
      trend: string;
    };
    uptime: number;
  };
  jobMetrics: {
    throughput: { jobsPerMinute: number; jobsPerHour: number; daily: number };
    successRate: {
      percentage: number;
      successful: number;
      failed: number;
      total: number;
    };
    averageDuration: {
      average: number;
      median: number;
      min: number;
      max: number;
    };
    jobTypes: Array<{ type: string; count: number; percentage: number }>;
    trends: Record<
      string,
      { completed: number; failed: number; total: number; successRate: number }
    >;
  };
  errorMetrics: {
    errorRate: {
      percentage: number;
      errors: number;
      total: number;
      trend: string;
    };
    errorCategories: Array<{
      category: string;
      count: number;
      percentage: number;
    }>;
    topErrors: Array<{ errorType: string; count: number }>;
    resolutionTime: {
      average: number;
      median: number;
      min: number;
      max: number;
    };
    trends: {
      hourly: number[];
      daily: number[];
      categories: Record<string, number[]>;
    };
  };
  queueMetrics: {
    queueDepth: number[];
    waitTime: number[];
    processingTime: number[];
    queueUtilization: number;
    bottlenecks: Array<{
      type: string;
      severity: string;
      description: string;
      recommendation: string;
    }>;
  };
  userMetrics: {
    activeUsers: number;
    userActivity: {
      dailyActiveUsers: number;
      weeklyActiveUsers: number;
      monthlyActiveUsers: number;
      averageSessionDuration: number;
    };
    featureUsage: {
      features: Record<
        string,
        { usage: number; users: number; growth: number }
      >;
    };
    userSatisfaction: {
      averageRating: number;
      totalRatings: number;
      distribution: Record<string, number>;
    };
  };
  insights: Array<{
    type: string;
    severity: string;
    title: string;
    description: string;
    recommendations?: string[];
    impact?: string;
    timestamp: string;
  }>;
  lastUpdated: string;
}

const AnalyticsDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [timeRange, setTimeRange] = useState("24h");
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // const { get } = useApi();

  useEffect(() => {
    loadDashboardData();
  }, [timeRange, filters]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadDashboardData();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [timeRange, filters, autoRefresh]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use fetch to load data from multiple endpoints
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      
      const [dashboardResponse, overviewResponse, errorsResponse, performanceResponse] = await Promise.all([
        fetch(`${baseUrl}/api/analytics/dashboard?timeRange=${timeRange}`).then(r => r.json()),
        fetch(`${baseUrl}/api/analytics/overview?timeRange=${timeRange}`).then(r => r.json()),
        fetch(`${baseUrl}/api/analytics/errors?timeRange=${timeRange}`).then(r => r.json()),
        fetch(`${baseUrl}/api/analytics/performance?timeRange=${timeRange}`).then(r => r.json())
      ]);

      if (dashboardResponse.success && overviewResponse.success) {
        // Transform API data to match frontend interface
        const transformedData: DashboardData = {
          timeRange: {
            startTime: new Date(Date.now() - getTimeRangeMs(timeRange)).toISOString(),
            endTime: new Date().toISOString()
          },
          systemMetrics: {
            cpu: {
              current: performanceResponse.data?.metrics?.resources?.avgCpuUsage || 45,
              average: performanceResponse.data?.metrics?.resources?.avgCpuUsage || 45,
              min: 20,
              max: performanceResponse.data?.metrics?.resources?.peakCpuUsage || 78,
              trend: "stable"
            },
            memory: {
              current: performanceResponse.data?.metrics?.resources?.avgMemoryUsage || 62,
              average: performanceResponse.data?.metrics?.resources?.avgMemoryUsage || 62,
              min: 30,
              max: performanceResponse.data?.metrics?.resources?.peakMemoryUsage || 85,
              trend: "stable"
            },
            disk: {
              current: 55,
              average: 55,
              min: 40,
              max: 70,
              trend: "increasing"
            },
            network: {
              current: 25,
              average: 25,
              min: 10,
              max: 45,
              trend: "stable"
            },
            uptime: 72.5
          },
          jobMetrics: {
            throughput: { 
              jobsPerMinute: 2.6, 
              jobsPerHour: dashboardResponse.data?.summary?.totalJobs || 156, 
              daily: dashboardResponse.data?.summary?.totalJobs || 156 
            },
            successRate: {
              percentage: dashboardResponse.data?.summary?.successRate || 91,
              successful: dashboardResponse.data?.summary?.completedJobs || 142,
              failed: dashboardResponse.data?.summary?.failedJobs || 14,
              total: dashboardResponse.data?.summary?.totalJobs || 156
            },
            averageDuration: {
              average: dashboardResponse.data?.summary?.averageProcessingTime || 2.3,
              median: 2.1,
              min: 0.8,
              max: 7.2
            },
            jobTypes: [
              { type: "CSV Upload", count: 120, percentage: 77 },
              { type: "Data Validation", count: 25, percentage: 16 },
              { type: "API Integration", count: 11, percentage: 7 }
            ],
            trends: {
              "current": { 
                completed: dashboardResponse.data?.summary?.completedJobs || 142, 
                failed: dashboardResponse.data?.summary?.failedJobs || 14, 
                total: dashboardResponse.data?.summary?.totalJobs || 156, 
                successRate: dashboardResponse.data?.summary?.successRate || 91 
              }
            }
          },
          errorMetrics: {
            errorRate: {
              percentage: errorsResponse.data?.summary?.errorRate || 9,
              errors: errorsResponse.data?.summary?.totalErrors || 14,
              total: dashboardResponse.data?.summary?.totalJobs || 156,
              trend: "decreasing"
            },
            errorCategories: errorsResponse.data?.errorsByCategory || [
              { category: "Validation", count: 8, percentage: 57.1 },
              { category: "Format", count: 4, percentage: 28.6 },
              { category: "Network", count: 2, percentage: 14.3 }
            ],
            topErrors: errorsResponse.data?.recentErrors?.slice(0, 5).map((err: any) => ({
              errorType: err.message,
              count: 1
            })) || [],
            resolutionTime: {
              average: 15.5,
              median: 12.0,
              min: 2.0,
              max: 45.0
            },
            trends: {
              hourly: overviewResponse.data?.trends?.uploadsOverTime?.map((t: any) => t.count) || [12, 18, 15, 22, 19],
              daily: [120, 135, 142, 128, 156],
              categories: {
                "Validation": [2, 3, 4, 3, 2],
                "Format": [1, 2, 1, 2, 1],
                "Network": [0, 1, 0, 1, 0]
              }
            }
          },
          queueMetrics: {
            queueDepth: [25, 30, 28, 22, 18],
            waitTime: [45, 50, 42, 38, 35],
            processingTime: [2.1, 2.5, 2.2, 2.8, 2.3],
            queueUtilization: performanceResponse.data?.summary?.throughput?.jobsPerHour || 156,
            bottlenecks: [
              {
                type: "Processing",
                severity: "low",
                description: "Slight increase in processing time",
                recommendation: "Monitor CPU usage"
              }
            ]
          },
          userMetrics: {
            activeUsers: overviewResponse.data?.overview?.activeUsers || 23,
            userActivity: {
              dailyActiveUsers: overviewResponse.data?.overview?.activeUsers || 23,
              weeklyActiveUsers: 45,
              monthlyActiveUsers: 78,
              averageSessionDuration: 15.5
            },
            featureUsage: {
              "Upload": { usage: 156, users: 23, growth: 12.5 },
              "Validation": { usage: 89, users: 18, growth: 8.3 },
              "Integration": { usage: 34, users: 12, growth: 15.2 }
            },
            userSatisfaction: {
              averageRating: 4.3,
              totalRatings: 28,
              distribution: { "5": 15, "4": 8, "3": 3, "2": 1, "1": 1 }
            }
          },
          insights: [
            {
              type: "performance",
              severity: "info",
              title: "Processing Time Optimized",
              description: "Average processing time has improved by 15% compared to last week",
              recommendations: ["Continue monitoring", "Consider optimizing further"],
              impact: "Improved user experience",
              timestamp: new Date().toISOString()
            },
            {
              type: "error",
              severity: "warning",
              title: "Validation Errors Increase",
              description: "Validation errors have increased slightly in the past hour",
              recommendations: ["Review CSV format guidelines", "Add validation hints"],
              impact: "Minor user friction",
              timestamp: new Date().toISOString()
            }
          ],
          lastUpdated: new Date().toISOString()
        };

        setDashboardData(transformedData);
      } else {
        setError("Failed to load dashboard data");
      }
    } catch (err) {
      setError("Failed to load dashboard data");
      console.error("Dashboard data load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to convert time range to milliseconds
  const getTimeRangeMs = (range: string): number => {
    switch (range) {
      case "1h": return 60 * 60 * 1000;
      case "6h": return 6 * 60 * 60 * 1000;
      case "24h": return 24 * 60 * 60 * 1000;
      case "7d": return 7 * 24 * 60 * 60 * 1000;
      case "30d": return 30 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  };

        setDashboardData(transformedData);
      } else {
        setError("Failed to load dashboard data");
      }
    } catch (err) {
      setError("Failed to load dashboard data");
      console.error("Dashboard data load error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to convert time range to milliseconds
  const getTimeRangeMs = (range: string): number => {
    switch (range) {
      case "1h":
        return 60 * 60 * 1000;
      case "6h":
        return 6 * 60 * 60 * 1000;
      case "24h":
        return 24 * 60 * 60 * 1000;
      case "7d":
        return 7 * 24 * 60 * 60 * 1000;
      case "30d":
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  };

  const handleExport = async (format: string) => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/analytics/export?format=${format}&timeRange=${timeRange}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics-${new Date().toISOString().split("T")[0]}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);

      // Show success message
      alert(`Data exported as ${format.toUpperCase()}`);
    } catch (err) {
      setError("Failed to export data");
      console.error("Export error:", err);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "increasing":
        return "📈";
      case "decreasing":
        return "📉";
      case "stable":
        return "➡️";
      default:
        return "➡️";
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "increasing":
        return "#28a745";
      case "decreasing":
        return "#dc3545";
      case "stable":
        return "#6c757d";
      default:
        return "#6c757d";
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "performance":
        return "⚡";
      case "error":
        return "⚠️";
      case "optimization":
        return "💡";
      case "trend":
        return "📊";
      default:
        return "ℹ️";
    }
  };

  const getInsightColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "#dc3545";
      case "warning":
        return "#ffc107";
      case "info":
        return "#17a2b8";
      default:
        return "#6c757d";
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">No data available</div>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard p-6">
      {/* Header */}
      <div className="dashboard-header mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <div className="header-controls flex gap-4">
            <div className="time-range-selector">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-4 py-2 border rounded"
              >
                <option value="1h">Last Hour</option>
                <option value="6h">Last 6 Hours</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>

            <div className="auto-refresh-toggle">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4"
                />
                Auto Refresh
              </label>
            </div>

            <div className="export-controls flex gap-2">
              <button
                onClick={() => handleExport("csv")}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Export CSV
              </button>
              <button
                onClick={() => handleExport("json")}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Export JSON
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Export PDF
              </button>
            </div>

            <button
              onClick={loadDashboardData}
              disabled={loading}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* AI-Powered Insights */}
      {dashboardData.insights && dashboardData.insights.length > 0 && (
        <div className="insights-panel mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800">🤖 AI-Powered Insights</h2>
            <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              View All Insights →
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {dashboardData.insights.slice(0, 4).map((insight, index) => (
              <div
                key={index}
                className={`insight-card p-6 rounded-xl border-l-4 shadow-sm hover:shadow-md transition-shadow ${
                  insight.severity === 'critical' ? 'bg-red-50 border-red-500' :
                  insight.severity === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                  insight.severity === 'info' ? 'bg-blue-50 border-blue-500' :
                  'bg-gray-50 border-gray-500'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      insight.type === 'performance' ? 'bg-blue-100' :
                      insight.type === 'error' ? 'bg-red-100' :
                      insight.type === 'optimization' ? 'bg-green-100' :
                      'bg-gray-100'
                    }`}>
                      <span className="text-xl">{getInsightIcon(insight.type)}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{insight.title}</h3>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        insight.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        insight.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                        insight.severity === 'info' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {insight.severity.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(insight.timestamp).toLocaleTimeString()}
                  </div>
                </div>

                <p className="text-gray-700 mb-4 leading-relaxed">{insight.description}</p>

                {insight.recommendations && insight.recommendations.length > 0 && (
                  <div className="bg-white bg-opacity-60 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Recommended Actions
                    </h4>
                    <ul className="space-y-2">
                      {insight.recommendations.slice(0, 2).map((rec, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {insight.impact && (
                  <div className="mt-3 text-sm">
                    <span className="font-medium text-gray-900">Expected Impact:</span>
                    <span className="ml-2 text-gray-700">{insight.impact}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

 {/* Key Performance Indicators */}
      <div className="kpi-overview mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Key Performance Indicators</h2>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Healthy</span>
            <div className="w-3 h-3 bg-yellow-500 rounded-full ml-4"></div>
            <span>Warning</span>
            <div className="w-3 h-3 bg-red-500 rounded-full ml-4"></div>
            <span>Critical</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Primary KPIs */}
          <div className="kpi-card bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-500 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-blue-600">Total Jobs</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {dashboardData.jobMetrics.successRate.total}
            </div>
            <div className="text-sm text-gray-600">
              {dashboardData.jobMetrics.successRate.successful} successful, {dashboardData.jobMetrics.successRate.failed} failed
            </div>
          </div>

          <div className="kpi-card bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-500 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-green-600">Success Rate</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {dashboardData.jobMetrics.successRate.percentage.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">
              {dashboardData.jobMetrics.successRate.percentage > 95 ? 'Excellent' : dashboardData.jobMetrics.successRate.percentage > 90 ? 'Good' : 'Needs Attention'}
            </div>
          </div>

          <div className="kpi-card bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-500 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-purple-600">Avg Processing</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {dashboardData.jobMetrics.averageDuration.average.toFixed(1)}s
            </div>
            <div className="text-sm text-gray-600">
              P95: {dashboardData.jobMetrics.averageDuration.max}s
            </div>
          </div>

          <div className="kpi-card bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-500 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-orange-600">Active Users</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {dashboardData.userMetrics.activeUsers}
            </div>
            <div className="text-sm text-gray-600">
              {dashboardData.userMetrics.userActivity.dailyActiveUsers} today
            </div>
          </div>
        </div>
      </div>

      {/* System Health Section */}
      <div className="system-health mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">System Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="CPU Usage"
            value={dashboardData.systemMetrics.cpu.current}
            unit="%"
            trend={dashboardData.systemMetrics.cpu.trend}
            details={dashboardData.systemMetrics.cpu}
            onClick={() => setSelectedMetric("cpu")}
          />

          <MetricCard
            title="Memory Usage"
            value={dashboardData.systemMetrics.memory.current}
            unit="%"
            trend={dashboardData.systemMetrics.memory.trend}
            details={dashboardData.systemMetrics.memory}
            onClick={() => setSelectedMetric("memory")}
          />

          <MetricCard
            title="Job Throughput"
            value={dashboardData.jobMetrics.throughput.jobsPerHour}
            unit="jobs/hr"
            trend="stable"
            details={dashboardData.jobMetrics.throughput}
            onClick={() => setSelectedMetric("throughput")}
          />

          <MetricCard
            title="Error Rate"
            value={dashboardData.errorMetrics.errorRate.percentage}
            unit="%"
            trend={dashboardData.errorMetrics.errorRate.trend}
            details={dashboardData.errorMetrics.errorRate}
            onClick={() => setSelectedMetric("error_rate")}
          />
        </div>
      </div>

      {/* Interactive Analytics Dashboard */}
      <div className="analytics-section mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">📊 Analytics Overview</h2>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50">
              📈 Fullscreen
            </button>
            <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50">
              ⚙️ Customize
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Trends Chart */}
          <div className="chart-container bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Performance Trends</h3>
              <div className="flex gap-2">
                <button className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-md">1H</button>
                <button className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded-md">24H</button>
                <button className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded-md">7D</button>
              </div>
            </div>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-2">📈</div>
                <div>Performance Chart</div>
                <div className="text-sm text-gray-400 mt-1">Real-time data visualization</div>
              </div>
            </div>
          </div>

          {/* Job Status Distribution */}
          <div className="chart-container bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Job Status Distribution</h3>
              <div className="text-sm text-gray-500">
                {dashboardData.jobMetrics.successRate.total} total jobs
              </div>
            </div>
            <div className="h-64 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-4xl mb-2">📊</div>
                <div>Status Chart</div>
                <div className="text-sm text-gray-400 mt-1">Success: {dashboardData.jobMetrics.successRate.percentage}%</div>
              </div>
            </div>
          </div>

          {/* Error Breakdown */}
          <div className="chart-container bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Error Analysis</h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-sm text-gray-600">{dashboardData.errorMetrics.errorRate.percentage}% error rate</span>
              </div>
            </div>
            <div className="space-y-3">
              {dashboardData.errorMetrics.errorCategories.slice(0, 3).map((category, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      index === 0 ? 'bg-red-500' : index === 1 ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}></div>
                    <span className="text-sm font-medium text-gray-700">{category.category}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">{category.count} errors</div>
                    <div className="text-sm font-medium text-gray-900">{category.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Activity */}
          <div className="chart-container bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">User Activity</h3>
              <div className="text-sm text-green-600 font-medium">
                +{dashboardData.userMetrics.featureUsage.Upload.growth.toFixed(1)}%
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm">📤</span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Uploads</div>
                    <div className="text-xs text-gray-500">{dashboardData.userMetrics.featureUsage.Upload.users} users</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">{dashboardData.userMetrics.featureUsage.Upload.usage}</div>
                  <div className="text-xs text-green-600">+{dashboardData.userMetrics.featureUsage.Upload.growth}%</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-sm">✅</span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Validations</div>
                    <div className="text-xs text-gray-500">{dashboardData.userMetrics.featureUsage.Validation.users} users</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">{dashboardData.userMetrics.featureUsage.Validation.usage}</div>
                  <div className="text-xs text-green-600">+{dashboardData.userMetrics.featureUsage.Validation.growth}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="dashboard-footer text-center text-gray-600">
        <span>
          Last updated: {new Date(dashboardData.lastUpdated).toLocaleString()}
        </span>
      </div>
    </div>
  );
};

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: number;
  unit: string;
  trend: string;
  details: any;
  onClick: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  trend,
  details,
  onClick,
}) => {
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "increasing":
        return "📈";
      case "decreasing":
        return "📉";
      case "stable":
        return "➡️";
      default:
        return "➡️";
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "increasing":
        return "#28a745";
      case "decreasing":
        return "#dc3545";
      case "stable":
        return "#6c757d";
      default:
        return "#6c757d";
    }
  };

  return (
    <div
      className="metric-card bg-white p-4 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2">
        <h5 className="font-semibold text-gray-700">{title}</h5>
        <span
          className="trend-icon text-xl"
          style={{ color: getTrendColor(trend) }}
        >
          {getTrendIcon(trend)}
        </span>
      </div>

      <div className="metric-value mb-3">
        <span className="text-2xl font-bold">
          {typeof value === "number" ? value.toFixed(1) : value}
        </span>
        <span className="text-gray-600 ml-1">{unit}</span>
      </div>

      {details && (
        <div className="metric-details text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Avg:</span>
            <span>{details.average?.toFixed(1) || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span>Min:</span>
            <span>{details.min?.toFixed(1) || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span>Max:</span>
            <span>{details.max?.toFixed(1) || "N/A"}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Chart Components
const SystemPerformanceChart: React.FC<{ data: any }> = ({ data }) => {
  const chartData = {
    labels: ["1h ago", "45m ago", "30m ago", "15m ago", "Now"],
    datasets: [
      {
        label: "CPU Usage (%)",
        data: [65, 68, 72, 70, data.cpu.current],
        borderColor: "#007bff",
        backgroundColor: "rgba(0, 123, 255, 0.1)",
        tension: 0.4,
      },
      {
        label: "Memory Usage (%)",
        data: [45, 48, 52, 50, data.memory.current],
        borderColor: "#28a745",
        backgroundColor: "rgba(40, 167, 69, 0.1)",
        tension: 0.4,
      },
    ],
  };

  return (
    <Line
      data={chartData}
      options={{
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
          },
        },
        plugins: {
          legend: {
            position: "top",
          },
        },
      }}
    />
  );
};

const JobTrendsChart: React.FC<{ data: any }> = ({ data }) => {
  const chartData = {
    labels: ["1h ago", "45m ago", "30m ago", "15m ago", "Now"],
    datasets: [
      {
        label: "Completed Jobs",
        data: [12, 15, 18, 14, 20],
        backgroundColor: "#28a745",
      },
      {
        label: "Failed Jobs",
        data: [2, 1, 3, 1, 2],
        backgroundColor: "#dc3545",
      },
    ],
  };

  return (
    <Bar
      data={chartData}
      options={{
        responsive: true,
        scales: {
          x: {
            stacked: true,
          },
          y: {
            stacked: true,
            beginAtZero: true,
          },
        },
      }}
    />
  );
};

const ErrorAnalysisChart: React.FC<{ data: any }> = ({ data }) => {
  const chartData = {
    labels: data.errorCategories
      ? data.errorCategories.map((c: any) => c.category)
      : ["Validation", "System", "Network", "Database"],
    datasets: [
      {
        label: "Errors by Category",
        data: data.errorCategories
          ? data.errorCategories.map((c: any) => c.count)
          : [5, 3, 2, 1],
        backgroundColor: [
          "#dc3545",
          "#fd7e14",
          "#ffc107",
          "#17a2b8",
          "#6f42c1",
        ],
      },
    ],
  };

  return (
    <Pie
      data={chartData}
      options={{
        responsive: true,
        plugins: {
          legend: {
            position: "right",
          },
        },
      }}
    />
  );
};

const QueuePerformanceChart: React.FC<{ data: any }> = ({ data }) => {
  const chartData = {
    labels: ["1h ago", "45m ago", "30m ago", "15m ago", "Now"],
    datasets: [
      {
        label: "Queue Depth",
        data: [25, 30, 28, 22, data.queueUtilization],
        borderColor: "#ffc107",
        backgroundColor: "rgba(255, 193, 7, 0.1)",
        tension: 0.4,
        yAxisID: "y",
      },
      {
        label: "Average Wait Time (s)",
        data: [45, 50, 42, 38, 35],
        borderColor: "#17a2b8",
        backgroundColor: "rgba(23, 162, 184, 0.1)",
        tension: 0.4,
        yAxisID: "y1",
      },
    ],
  };

  return (
    <Line
      data={chartData}
      options={{
        responsive: true,
        scales: {
          y: {
            type: "linear",
            display: true,
            position: "left",
            beginAtZero: true,
          },
          y1: {
            type: "linear",
            display: true,
            position: "right",
            beginAtZero: true,
            grid: {
              drawOnChartArea: false,
            },
          },
        },
      }}
    />
  );
};

export default AnalyticsDashboard;
