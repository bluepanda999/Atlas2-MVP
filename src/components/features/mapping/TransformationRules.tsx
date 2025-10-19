import React from 'react';
import { TransformationRule } from '../../../types';
import { Button, Input } from '../../common';
import { cn } from '../../../utils/helpers';

export interface TransformationRulesProps {
  rules: TransformationRule[];
  onRuleAdd?: (rule: Omit<TransformationRule, 'id'>) => void;
  onRuleUpdate?: (ruleId: string, rule: Partial<TransformationRule>) => void;
  onRuleDelete?: (ruleId: string) => void;
  className?: string;
}

const TransformationRules: React.FC<TransformationRulesProps> = ({
  rules,
  onRuleAdd,
  onRuleUpdate,
  onRuleDelete,
  className,
}) => {
  const getRuleTypeDescription = (type: TransformationRule['type']) => {
    switch (type) {
      case 'format':
        return 'Format data (e.g., date format, phone number)';
      case 'validation':
        return 'Validate data (e.g., email format, required fields)';
      case 'transformation':
        return 'Transform data (e.g., uppercase, lowercase, trim)';
      case 'lookup':
        return 'Lookup values from external source';
      default:
        return 'Unknown rule type';
    }
  };

  const getRuleIcon = (type: TransformationRule['type']) => {
    switch (type) {
      case 'format':
        return (
          <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'validation':
        return (
          <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'transformation':
        return (
          <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'lookup':
        return (
          <svg className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (rules.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <div className="mx-auto w-12 h-12 text-gray-400 mb-4">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No transformation rules</h3>
        <p className="text-gray-500 mb-4">Add rules to transform your data during processing.</p>
        {onRuleAdd && (
          <Button onClick={() => onRuleAdd({
            name: 'New Rule',
            type: 'transformation',
            sourceField: '',
            targetField: '',
            configuration: {},
            enabled: true,
          })}>
            Add Rule
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Transformation Rules</h3>
        {onRuleAdd && (
          <Button onClick={() => onRuleAdd({
            name: 'New Rule',
            type: 'transformation',
            sourceField: '',
            targetField: '',
            configuration: {},
            enabled: true,
          })}>
            Add Rule
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                {getRuleIcon(rule.type)}
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{rule.name}</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    {getRuleTypeDescription(rule.type)}
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    {rule.sourceField && (
                      <p>Source: <span className="font-medium">{rule.sourceField}</span></p>
                    )}
                    {rule.targetField && (
                      <p>Target: <span className="font-medium">{rule.targetField}</span></p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => onRuleUpdate?.(rule.id, { enabled: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Enabled</span>
                </label>
                
                {onRuleDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRuleDelete(rule.id)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TransformationRules;