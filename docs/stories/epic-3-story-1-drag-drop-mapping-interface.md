# Story 3.1: Drag-and-Drop Mapping Interface - Brownfield Addition

## User Story

As a data analyst,
I want to visually map CSV columns to API parameters using an intuitive drag-and-drop interface,
So that I can quickly configure data transformations without writing code or dealing with complex configuration files.

## Story Context

**Existing System Integration:**

- Integrates with: CSV processing pipeline (Epic 1) and API client generation (Epic 2)
- Technology: React frontend with TypeScript, Node.js backend, react-beautiful-dnd library
- Follows pattern: React component patterns, Ant Design components, RESTful API design
- Touch points: CSV preview API, API schema service, mapping validation endpoint

## Acceptance Criteria

**Functional Requirements:**

1. Users can drag CSV columns from a source list and drop them onto API parameters in a target list
2. Visual feedback shows valid drop zones, invalid mappings, and mapping conflicts
3. Interface displays CSV data preview (first 5 rows) alongside API parameter requirements
4. Search and filtering capabilities for both CSV columns and API parameters
5. One-to-many and many-to-one mapping support with clear visual indicators

**Integration Requirements:** 6. CSV data preview integration with existing `/api/csv/preview/{uploadId}` endpoint 7. API schema integration with existing `/api/specs/{specId}/schema` endpoint 8. Mapping validation integration with new `/api/mappings/validate` endpoint 9. Existing UI components and patterns from Ant Design library are maintained

**Quality Requirements:** 10. Drag-and-drop interactions are smooth and responsive (<200ms response time) 11. Visual feedback is clear and intuitive with color coding and icons 12. Interface supports 100+ columns without performance degradation 13. Keyboard navigation support for accessibility compliance 14. No regression in existing CSV upload or API generation functionality

## Technical Notes

- **Integration Approach:** New React components integrate with existing CSV and API services
- **Existing Pattern Reference:** Follow established component structure and API response patterns
- **Key Constraints:** Must handle large datasets efficiently, maintain state consistency, provide real-time validation

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Documentation updated (component docs, API docs)

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** Drag-and-drop performance degradation with large datasets
- **Mitigation:** Implement virtual scrolling, efficient state management, and debounced validation
- **Rollback:** Disable drag-and-drop and fall back to dropdown-based mapping if issues occur

**Compatibility Verification:**

- [ ] No breaking changes to existing CSV or API endpoints
- [ ] New components follow existing Ant Design patterns
- [ ] State management integrates with existing Zustand stores
- [ ] Performance impact is minimal during mapping operations

## Story Points Estimation

**Estimation:** 8 points

- Drag-and-drop component implementation: 3 points
- CSV and API integration: 2 points
- Visual feedback and validation: 2 points
- Search and filtering: 1 point

## Dependencies

- CSV processing pipeline (Epic 1) for data preview
- API client generation (Epic 2) for schema information
- react-beautiful-dnd library integration
- Ant Design component library

## Testing Requirements

**Unit Tests:**

- Drag-and-drop interaction logic
- Mapping validation rules
- Search and filtering functionality
- State management operations

**Integration Tests:**

- CSV preview API integration
- API schema service integration
- End-to-end mapping workflow
- Large dataset handling

**Performance Tests:**

- Drag-and-drop responsiveness with 100+ columns
- Memory usage during mapping operations
- UI rendering performance
- Search/filter response times

## Implementation Notes

**Frontend Component Structure:**

```typescript
interface MappingInterfaceProps {
  csvUploadId: string;
  apiSpecId: string;
  onMappingComplete: (mapping: FieldMapping[]) => void;
}

const MappingInterface: React.FC<MappingInterfaceProps> = ({
  csvUploadId,
  apiSpecId,
  onMappingComplete,
}) => {
  // Component implementation
};
```

**Key Components:**

- `ColumnList`: Draggable CSV columns with data preview
- `ParameterList`: Droppable API parameters with requirements
- `MappingCanvas`: Visual mapping area with connection lines
- `SearchFilter`: Search and filter controls
- `ValidationPanel`: Real-time validation feedback

**State Management:**

```typescript
interface MappingState {
  csvColumns: CsvColumn[];
  apiParameters: ApiParameter[];
  mappings: FieldMapping[];
  validationErrors: ValidationError[];
  searchTerm: string;
  filterOptions: FilterOptions;
}
```

**API Integration:**

```typescript
// Existing CSV preview endpoint
GET /api/csv/preview/{uploadId}

// Existing API schema endpoint
GET /api/specs/{specId}/schema

// New mapping validation endpoint
POST /api/mappings/validate
{
  "csvUploadId": "string",
  "apiSpecId": "string",
  "mappings": "FieldMapping[]"
}
```

**Drag-and-Drop Configuration:**

```typescript
const dragDropConfig = {
  droppableId: "api-parameters",
  draggableId: "csv-columns",
  type: "MAPPING",
  direction: "vertical",
  isDropDisabled: false,
};
```

**Visual Feedback System:**

- Green: Valid mapping
- Red: Invalid mapping (type mismatch, required field missing)
- Yellow: Warning (potential data loss, format conversion needed)
- Blue: Selected/highlighted mapping

**Error Handling:**

- Invalid drop zones: Visual shake animation
- Type mismatches: Clear error messages with suggestions
- Required field violations: Bold indicators and tooltips
- Network errors: Retry mechanisms and offline support

## Success Criteria

- Users can successfully map CSV columns to API parameters using drag-and-drop
- Visual feedback clearly indicates valid and invalid mappings
- Search and filtering work efficiently with large datasets
- Interface remains responsive with 100+ columns
- Integration with CSV preview and API schema works seamlessly

## QA Results

### Review Date: TBD

### Reviewed By: TBD

### Code Quality Assessment

_To be completed during QA review_

### Gate Status

Gate: TBD → qa.qaLocation/gates/3.1-drag-drop-mapping-interface.yml

### Recommended Status

_To be determined after implementation and review_
