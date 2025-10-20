import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Badge, Progress, Button, Tabs, Alert, Space, Tooltip, Modal, message } from 'antd';
import { 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  CloseCircleOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  ReloadOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import { io, Socket } from 'socket.io-client';
import { DataValidationProps, ValidationResult, ValidationProgress, ValidationSession } from '../../types/validation';

const { TabPane } = Tabs;

interface ValidationState {
  progress: ValidationProgress | null;
  result: ValidationResult | null;
  isConnected: boolean;
  error: string | null;
}

export const DataValidation: React.FC<DataValidationProps> = ({
  fileId,
  fileName,
  onValidationComplete,
  onValidationError,
  className,
}) => {
  const navigate = useNavigate();
  const [validationState, setValidationState] = useState<ValidationState>({
    progress: null,
    result: null,
    isConnected: false,
    error: null,
  });
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeTab, setActiveTab] = useState<string>('progress');
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);

   // Initialize WebSocket connection
   useEffect(() => {
     if (!fileId) return;

     const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:3000', {
       transports: ['websocket', 'polling'],
     });

     newSocket.on('connect', () => {
       console.log('Connected to validation WebSocket');
       setValidationState(prev => ({ ...prev, isConnected: true }));
       
       // Authenticate
       const token = localStorage.getItem('authToken');
       if (token) {
         newSocket.emit('authenticate', { token });
       }
       
       // Subscribe to validation updates
       newSocket.emit('join_validation', { fileId });
     });

     newSocket.on('disconnect', () => {
       console.log('Disconnected from validation WebSocket');
       setValidationState(prev => ({ ...prev, isConnected: false }));
     });

     newSocket.on('validation_progress', (data: ValidationSession) => {
       setValidationState(prev => ({
         ...prev,
         progress: data.progress,
         result: data.result || prev.result,
       }));
     });

     newSocket.on('validation_completed', (data: ValidationSession) => {
       setValidationState(prev => ({
         ...prev,
         result: data.result,
         progress: null,
       }));
       
       setActiveTab('results');
       onValidationComplete?.(data.result!);
       
       message.success('Validation completed successfully!');
     });

     newSocket.on('validation_error', (data: { error: string }) => {
       setValidationState(prev => ({
         ...prev,
         error: data.error,
         progress: null,
       }));
       
       onValidationError?.(data.error);
       message.error(`Validation failed: ${data.error}`);
     });

     setSocket(newSocket);

     return () => {
       if (fileId) {
         newSocket.emit('leave_validation', { fileId });
       }
       newSocket.disconnect();
     };
   }, [fileId, onValidationComplete, onValidationError]);

   const startValidation = useCallback(async () => {
     try {
       setValidationState(prev => ({ ...prev, error: null }));
       
       const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/api/validation/session`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
         },
         body: JSON.stringify({
           fileId,
           rules: [], // Use default rules for now
           fullValidation: true,
         }),
       });

       if (!response.ok) {
         throw new Error('Failed to start validation');
       }

       const data = await response.json();
       
       message.info('Validation started...');
       setActiveTab('progress');
     } catch (error) {
       const errorMessage = error instanceof Error ? error.message : 'Failed to start validation';
       setValidationState(prev => ({ ...prev, error: errorMessage }));
       onValidationError?.(errorMessage);
       message.error(errorMessage);
     }
   }, [fileId, onValidationError]);

   const downloadReport = useCallback(async () => {
     try {
       const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/api/validation/export`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
         },
         body: JSON.stringify({ fileId }),
       });

       if (!response.ok) {
         throw new Error('Failed to download validation report');
       }

       const data = await response.json();
       
       // Create download link
       const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
       const url = window.URL.createObjectURL(blob);
       const link = document.createElement('a');
       link.href = url;
       link.download = `validation-report-${fileId}.json`;
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
       window.URL.revokeObjectURL(url);
       
       message.success('Validation report downloaded successfully!');
     } catch (error) {
       message.error('Failed to download validation report');
     }
   }, [fileId]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'warning':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'info':
        return <InfoCircleOutlined style={{ color: '#1890ff' }} />;
      default:
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const status = severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : 'default';
    return <Badge status={status} text={severity} />;
  };

  const renderProgressTab = () => {
    const { progress, isConnected } = validationState;
    
    if (!progress) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Space direction="vertical" size="large">
            <div>
              {isConnected ? (
                <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a' }} />
              ) : (
                <CloseCircleOutlined style={{ fontSize: '48px', color: '#ff4d4f' }} />
              )}
            </div>
            <div>
              <h3>
                {isConnected ? 'Connected to validation service' : 'Connecting to validation service...'}
              </h3>
              <p>Real-time updates will appear here once validation starts.</p>
            </div>
            <Button 
              type="primary" 
              icon={<ReloadOutlined />}
              onClick={startValidation}
              disabled={!isConnected}
            >
              Start Validation
            </Button>
          </Space>
        </div>
      );
    }

    return (
      <div style={{ padding: '20px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <h3>Validation Progress</h3>
            <Progress 
              percent={progress.percentage} 
              status={progress.percentage === 100 ? 'success' : 'active'}
              format={(percent) => `${percent}% (${progress.currentRow.toLocaleString()} / ${progress.totalRows.toLocaleString()} rows)`}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                  {progress.processingRate.toFixed(0)}
                </div>
                <div style={{ color: '#666' }}>Rows/Second</div>
              </div>
            </Card>
            
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>
                  {progress.errorsFound.toLocaleString()}
                </div>
                <div style={{ color: '#666' }}>Errors Found</div>
              </div>
            </Card>
            
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                  {progress.warningsFound.toLocaleString()}
                </div>
                <div style={{ color: '#666' }}>Warnings Found</div>
              </div>
            </Card>
            
            {progress.estimatedTimeRemaining && (
              <Card size="small">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                    {Math.round(progress.estimatedTimeRemaining)}s
                  </div>
                  <div style={{ color: '#666' }}>Est. Time Remaining</div>
                </div>
              </Card>
            )}
          </div>
        </Space>
      </div>
    );
  };

  const renderResultsTab = () => {
    const { result } = validationState;
    
    if (!result) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>No validation results available yet.</p>
          <Button onClick={startValidation}>Start Validation</Button>
        </div>
      );
    }

    const errorColumns = [
      {
        title: 'Row',
        dataIndex: 'row',
        key: 'row',
        width: 80,
      },
      {
        title: 'Field',
        dataIndex: 'field',
        key: 'field',
        width: 150,
      },
      {
        title: 'Value',
        dataIndex: 'value',
        key: 'value',
        width: 200,
        render: (value: any) => (
          <Tooltip title={String(value)}>
            <div style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {String(value)}
            </div>
          </Tooltip>
        ),
      },
      {
        title: 'Severity',
        dataIndex: 'severity',
        key: 'severity',
        width: 100,
        render: (severity: string) => getSeverityBadge(severity),
      },
      {
        title: 'Rule',
        dataIndex: 'rule',
        key: 'rule',
        width: 150,
      },
      {
        title: 'Message',
        dataIndex: 'message',
        key: 'message',
        render: (message: string) => (
          <Tooltip title={message}>
            <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {message}
            </div>
          </Tooltip>
        ),
      },
    ];

    const previewColumns = [
      {
        title: 'Row',
        dataIndex: 'row',
        key: 'row',
        width: 80,
      },
      ...Object.keys(result.preview[0]?.data || {}).map(key => ({
        title: key,
        dataIndex: ['data', key],
        key,
        width: 150,
        render: (value: any) => (
          <div style={{ 
            maxWidth: '130px', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap' 
          }}>
            {String(value || '')}
          </div>
        ),
      })),
      {
        title: 'Status',
        dataIndex: 'validation',
        key: 'validation',
        width: 120,
        render: (validation: any) => (
          <Space>
            {validation.hasErrors && <Badge status="error" count={validation.errorCount} />}
            {validation.hasWarnings && <Badge status="warning" count={validation.warningCount} />}
            {!validation.hasErrors && !validation.hasWarnings && <Badge status="success" text="OK" />}
          </Space>
        ),
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 80,
        render: (record: any) => (
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedRow(record);
              setPreviewModalVisible(true);
            }}
          />
        ),
      },
    ];

    return (
      <div style={{ padding: '20px' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: result.isValid ? '#52c41a' : '#ff4d4f' }}>
                  {result.isValid ? 'Valid' : 'Invalid'}
                </div>
                <div style={{ color: '#666' }}>Overall Status</div>
              </div>
            </Card>
            
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {result.summary.totalRows.toLocaleString()}
                </div>
                <div style={{ color: '#666' }}>Total Rows</div>
              </div>
            </Card>
            
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff4d4f' }}>
                  {result.summary.errorRows.toLocaleString()}
                </div>
                <div style={{ color: '#666' }}>Error Rows ({((result.summary.errorRows / result.summary.totalRows) * 100).toFixed(1)}%)</div>
              </div>
            </Card>
            
            <Card size="small">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                  {result.summary.warningRows.toLocaleString()}
                </div>
                <div style={{ color: '#666' }}>Warning Rows ({((result.summary.warningRows / result.summary.totalRows) * 100).toFixed(1)}%)</div>
              </div>
            </Card>
          </div>

          {/* Action Buttons */}
          <Space>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />}
              onClick={downloadReport}
            >
              Download Report
            </Button>
            <Button 
              icon={<ReloadOutlined />}
              onClick={startValidation}
            >
              Re-validate
            </Button>
          </Space>

          {/* Results Tables */}
          <Tabs defaultActiveKey="errors">
            <TabPane tab={`Errors (${result.errors.length})`} key="errors">
              <Table
                columns={errorColumns}
                dataSource={result.errors}
                rowKey={(record, index) => `${record.row}-${record.field}-${index}`}
                pagination={{ pageSize: 50 }}
                scroll={{ x: 800 }}
                size="small"
              />
            </TabPane>
            
            <TabPane tab={`Warnings (${result.warnings.length})`} key="warnings">
              <Table
                columns={errorColumns}
                dataSource={result.warnings}
                rowKey={(record, index) => `${record.row}-${record.field}-${index}`}
                pagination={{ pageSize: 50 }}
                scroll={{ x: 800 }}
                size="small"
              />
            </TabPane>
          </Tabs>
        </Space>
      </div>
    );
  };

  if (!fileId) {
    return (
      <Card title="Data Validation & Preview">
        <Alert
          message="No File Selected"
          description="Please upload a file first before proceeding with validation."
          type="warning"
          showIcon
          action={
            <Button size="small" onClick={() => navigate('/upload')}>
              Upload File
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <Card 
      title={`Data Validation & Preview - ${fileName}`}
      className={className}
      extra={
        <Space>
          <Badge 
            status={validationState.isConnected ? 'success' : 'error'} 
            text={validationState.isConnected ? 'Connected' : 'Disconnected'} 
          />
          <Button 
            type="primary" 
            icon={<PlayCircleOutlined />}
            onClick={startValidation}
            disabled={!validationState.isConnected}
          >
            Start Validation
          </Button>
        </Space>
      }
    >
      {validationState.error && (
        <Alert
          message="Validation Error"
          description={validationState.error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: '16px' }}
        />
      )}

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Progress" key="progress">
          {renderProgressTab()}
        </TabPane>
        <TabPane tab="Results" key="results">
          {renderResultsTab()}
        </TabPane>
      </Tabs>

      {/* Row Detail Modal */}
      <Modal
        title={`Row ${selectedRow?.row} Details`}
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedRow && (
          <div>
            <Table
              dataSource={Object.entries(selectedRow.data).map(([key, value]) => ({
                field: key,
                value: String(value || ''),
              }))}
              columns={[
                { title: 'Field', dataIndex: 'field', key: 'field' },
                { title: 'Value', dataIndex: 'value', key: 'value' },
              ]}
              pagination={false}
              size="small"
            />
          </div>
        )}
      </Modal>
    </Card>
  );
};