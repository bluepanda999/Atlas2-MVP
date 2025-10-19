import React from 'react';
import { Layout } from '../components/layout';
import { Button } from '../components/common';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const stats = [
    {
      name: 'Total Uploads',
      value: '1,234',
      change: '+12%',
      changeType: 'positive' as const,
    },
    {
      name: 'Records Processed',
      value: '45.2K',
      change: '+23%',
      changeType: 'positive' as const,
    },
    {
      name: 'Active Integrations',
      value: '8',
      change: '0%',
      changeType: 'neutral' as const,
    },
    {
      name: 'Success Rate',
      value: '98.5%',
      change: '+2%',
      changeType: 'positive' as const,
    },
  ];

  const recentActivity = [
    {
      id: '1',
      type: 'upload',
      description: 'CSV file "customers.csv" uploaded successfully',
      timestamp: '2 minutes ago',
      status: 'completed',
    },
    {
      id: '2',
      type: 'mapping',
      description: 'Field mapping updated for "products.csv"',
      timestamp: '15 minutes ago',
      status: 'completed',
    },
    {
      id: '3',
      type: 'integration',
      description: 'API integration with Salesforce connected',
      timestamp: '1 hour ago',
      status: 'completed',
    },
    {
      id: '4',
      type: 'upload',
      description: 'CSV file "orders.csv" processing failed',
      timestamp: '2 hours ago',
      status: 'failed',
    },
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'upload':
        return (
          <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        );
      case 'mapping':
        return (
          <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        );
      case 'integration':
        return (
          <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <Layout title="Dashboard" subtitle="Welcome to Atlas2">
      <div className="space-y-6">
        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button onClick={() => navigate('/upload')} className="justify-center">
              Upload CSV File
            </Button>
            <Button variant="outline" onClick={() => navigate('/mapping')} className="justify-center">
              Create Field Mapping
            </Button>
            <Button variant="outline" onClick={() => navigate('/integrations')} className="justify-center">
              Configure Integration
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div key={stat.name} className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                </div>
                <div className={`flex items-center text-sm ${
                  stat.changeType === 'positive' ? 'text-green-600' : 
                  stat.changeType === 'negative' ? 'text-red-600' : 'text-gray-500'
                }`}>
                  {stat.changeType !== 'neutral' && (
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {stat.changeType === 'positive' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      )}
                    </svg>
                  )}
                  {stat.change}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="px-6 py-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{activity.description}</p>
                    <p className="text-sm text-gray-500">{activity.timestamp}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
                      {activity.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;