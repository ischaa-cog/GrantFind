import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Plus, Settings, Eye, Copy, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useCompanyAuth } from "@/hooks/useCompanyAuth";
import { apiRequest } from "@/lib/queryClient";

interface FormField {
  id: string;
  fieldType: string;
  label: string;
  placeholder?: string;
  required: boolean;
  options: string[];
  sortOrder: number;
  shortLabel?: string;
  queryKey?: string;
  fieldWidth?: number;
  hidden?: boolean;
  labelAlignment?: 'left' | 'center' | 'right';
  textContent?: string;
  linkUrl?: string;
  buttonFontSize?: number;
  buttonAlignment?: 'left' | 'center' | 'right';
  buttonBgColor?: string;
  buttonTextColor?: string;
}

interface FormTemplate {
  id?: number;
  name: string;
  description?: string;
  isActive: boolean;
}

export default function FormBuilderPage() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const { company, isAuthenticated } = useCompanyAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Determine if we're in edit mode
  const isEditMode = !!params.id;
  const templateId = params.id;

  // Form template state
  const [formTemplate, setFormTemplate] = useState<FormTemplate>({
    name: "Untitled Form",
    description: "",
    isActive: true,
  });

  // Form fields state
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null);

  // UI state
  const [isSaving, setIsSaving] = useState(false);

  // Fetch existing template data when in edit mode
  const { data: existingTemplate, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ['/api/company/form-templates', templateId],
    queryFn: async () => {
      if (!templateId) return null;
      
      const response = await apiRequest(`/api/company/form-templates/${templateId}`);
      const templateData = await response.json();
      
      // Also fetch the fields for this template
      const fieldsResponse = await apiRequest(`/api/company/form-templates/${templateId}/fields`);
      const fieldsData = await fieldsResponse.json();
      
      return { template: templateData, fields: fieldsData };
    },
    enabled: isEditMode && !!templateId
  });

  // Preload form data when editing existing template
  useEffect(() => {
    if (existingTemplate) {
      // Set template data
      setFormTemplate({
        id: existingTemplate.template.id,
        name: existingTemplate.template.name,
        description: existingTemplate.template.description || "",
        isActive: existingTemplate.template.isActive
      });

      // Set fields data
      const fieldsWithStringIds = existingTemplate.fields.map((field: any) => ({
        ...field,
        id: `field_${field.id}`, // Convert numeric ID to string format expected by the UI
        options: field.options || [],
        sortOrder: field.sortOrder || 0,
        shortLabel: field.shortLabel || '',
        queryKey: field.queryKey || `field_${field.id}`,
        fieldWidth: field.fieldWidth || 100,
        hidden: field.hidden || false,
        labelAlignment: field.labelAlignment || 'left',
        textContent: field.textContent || '',
        linkUrl: field.linkUrl || '',
        buttonFontSize: field.buttonFontSize || 16,
        buttonAlignment: field.buttonAlignment || 'left',
        buttonBgColor: field.buttonBgColor || '#EAB308',
        buttonTextColor: field.buttonTextColor || '#000000'
      }));
      
      setFormFields(fieldsWithStringIds);
    }
  }, [existingTemplate]);

  // Get selected field
  const selectedField = formFields.find(field => field.id === selectedFieldId);

  // Form element categories matching GoHighLevel
  const formElements = {
    text: [
      { type: 'single_text', label: 'Single Line', icon: '📝' },
      { type: 'multi_text', label: 'Multi Line', icon: '📄' },
      { type: 'text_list', label: 'Text Box List', icon: '📋' }
    ],
    choice: [
      { type: 'single_dropdown', label: 'Single Dropdown', icon: '🔽' },
      { type: 'multi_dropdown', label: 'Multi Dropdown', icon: '🔽' },
      { type: 'checkbox', label: 'Checkbox', icon: '☑️' }
    ],
    other: [
      { type: 'radio', label: 'Radio', icon: '🔘' },
      { type: 'rating', label: 'Rating', icon: '⭐' },
      { type: 'terms_and_conditions', label: 'Terms & Conditions', icon: '📋' },
      { type: 'button', label: 'Button', icon: '🔲' }
    ]
  };

  // Add new field to form
  const addField = (fieldType: string) => {
    const newField: FormField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fieldType,
      label: fieldType === 'button' ? 'Submit' : `New ${fieldType.replace('_', ' ')} Field`,
      placeholder: '',
      required: false,
      options: [],
      sortOrder: formFields.length,
      shortLabel: '',
      queryKey: `field_${formFields.length + 1}`,
      fieldWidth: 100,
      hidden: false,
      labelAlignment: 'left',
      textContent: fieldType === 'terms_and_conditions' 
        ? 'By checking this box and submitting this form, I agree to the terms and conditions listed here.' 
        : undefined,
      linkUrl: fieldType === 'terms_and_conditions' 
        ? '' 
        : undefined,
      buttonFontSize: fieldType === 'button' ? 16 : undefined,
      buttonAlignment: fieldType === 'button' ? 'left' : undefined,
      buttonBgColor: fieldType === 'button' ? '#EAB308' : undefined,
      buttonTextColor: fieldType === 'button' ? '#000000' : undefined
    };

    setFormFields([...formFields, newField]);
    setSelectedFieldId(newField.id);
  };

  // Update selected field
  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setFormFields(formFields.map(field => 
      field.id === fieldId ? { ...field, ...updates } : field
    ));
  };

  // Delete field
  const deleteField = (fieldId: string) => {
    setFormFields(formFields.filter(field => field.id !== fieldId));
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedFieldIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedFieldIndex === null || draggedFieldIndex === index) return;
    
    const newFields = [...formFields];
    const draggedField = newFields[draggedFieldIndex];
    newFields.splice(draggedFieldIndex, 1);
    newFields.splice(index, 0, draggedField);
    
    // Update sort orders
    const updatedFields = newFields.map((field, idx) => ({
      ...field,
      sortOrder: idx
    }));
    
    setFormFields(updatedFields);
    setDraggedFieldIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedFieldIndex(null);
  };

  // Save form template mutation
  const saveFormTemplateMutation = useMutation({
    mutationFn: async ({ templateData, fields }: { templateData: any; fields: any[] }) => {
      let templateResult: any;
      
      if (isEditMode && templateId) {
        // Update existing template
        const templateResponse = await apiRequest(`/api/company/form-templates/${templateId}`, {
          method: 'PUT',
          body: JSON.stringify(templateData),
        });
        templateResult = await templateResponse.json();
        
        // Delete existing fields first, then recreate them
        await apiRequest(`/api/company/form-templates/${templateId}/fields`, {
          method: 'DELETE',
        });
        
        // Create new/updated fields
        const fieldPromises = fields.map(field => {
          const fieldData = {
            fieldType: field.fieldType,
            label: field.label,
            placeholder: field.placeholder || null,
            required: field.required || false,
            options: field.options || null,
            sortOrder: field.sortOrder,
            textContent: field.textContent || null,
            linkUrl: field.linkUrl || null,
            buttonFontSize: field.buttonFontSize || null,
            buttonAlignment: field.buttonAlignment || null,
            buttonBgColor: field.buttonBgColor || null,
            buttonTextColor: field.buttonTextColor || null
          };
          
          return apiRequest(`/api/company/form-templates/${templateId}/fields`, {
            method: 'POST',
            body: JSON.stringify(fieldData),
          });
        });
        
        await Promise.all(fieldPromises);
      } else {
        // Create new template
        const templateResponse = await apiRequest('/api/company/form-templates', {
          method: 'POST',
          body: JSON.stringify(templateData),
        });
        
        templateResult = await templateResponse.json();
        
        const fieldPromises = fields.map(field => {
          const fieldData = {
            fieldType: field.fieldType,
            label: field.label,
            placeholder: field.placeholder || null,
            required: field.required || false,
            options: field.options || null,
            sortOrder: field.sortOrder,
            textContent: field.textContent || null,
            linkUrl: field.linkUrl || null,
            buttonFontSize: field.buttonFontSize || null,
            buttonAlignment: field.buttonAlignment || null,
            buttonBgColor: field.buttonBgColor || null,
            buttonTextColor: field.buttonTextColor || null
          };
          
          return apiRequest(`/api/company/form-templates/${templateResult.id}/fields`, {
            method: 'POST',
            body: JSON.stringify(fieldData),
          });
        });
        
        await Promise.all(fieldPromises);
      }
      
      return templateResult;
    },
    onSuccess: (data) => {
      toast({
        title: "Form Template Saved",
        description: `"${formTemplate.name}" has been ${isEditMode ? 'updated' : 'created'} successfully with ${formFields.length} fields.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/company/form-templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/company/form-templates', templateId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditMode ? 'update' : 'save'} form template. Please try again.`,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!formTemplate.name.trim() || formFields.length === 0) {
      toast({
        title: "Error",
        description: "Please provide a form name and add at least one field.",
        variant: "destructive",
      });
      return;
    }

    const templateData = {
      name: formTemplate.name.trim(),
      description: formTemplate.description?.trim() || null,
      isActive: formTemplate.isActive,
    };

    saveFormTemplateMutation.mutate({ templateData, fields: formFields });
  };

  const handleExit = () => {
    setLocation('/company/dashboard');
  };

  // Render form field in center panel
  const renderFormField = (field: FormField, index: number) => {
    const isSelected = selectedFieldId === field.id;
    const isDragging = draggedFieldIndex === index;
    
    return (
      <div
        key={field.id}
        draggable
        onDragStart={(e) => handleDragStart(e, index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragEnd={handleDragEnd}
        className={`cursor-move transition-all duration-200 ${
          isDragging ? 'opacity-50' : ''
        } ${
          field.fieldType === 'button' || field.fieldType === 'terms_and_conditions'
            ? 'relative' 
            : `p-4 border rounded-lg ${
                isSelected 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`
        }`}
        onClick={() => setSelectedFieldId(field.id)}
        data-testid={`form-field-${field.id}`}
      >
        {field.fieldType !== 'terms_and_conditions' && field.fieldType !== 'button' && (
          <div className="flex items-center justify-between mb-2">
            <Label className="font-medium text-sm">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="flex items-center space-x-1">
              <GripVertical className="w-4 h-4 text-gray-400" />
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteField(field.id);
                }}
                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
        
        {(field.fieldType === 'terms_and_conditions' || field.fieldType === 'button') && (
          <div className="absolute top-2 right-2 flex items-center space-x-1">
            <GripVertical className="w-4 h-4 text-gray-400" />
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                deleteField(field.id);
              }}
              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        )}
        
        {/* Render field based on type */}
        {field.fieldType === 'single_text' && (
          <Input
            placeholder={field.placeholder || "Enter text here..."}
            disabled
            className="bg-gray-50 dark:bg-gray-800"
          />
        )}
        
        {field.fieldType === 'multi_text' && (
          <Textarea
            placeholder={field.placeholder || "Enter your message here..."}
            disabled
            className="bg-gray-50 dark:bg-gray-800"
            rows={3}
          />
        )}
        
        {field.fieldType === 'single_dropdown' && (
          <div>
            <Select disabled>
              <SelectTrigger className="bg-gray-50 dark:bg-gray-800">
                <SelectValue placeholder={field.placeholder || "Select an option"} />
              </SelectTrigger>
            </Select>
            {field.options.length > 0 && (
              <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                <p className="text-xs text-gray-500 mb-1">Available options:</p>
                <ul className="text-sm space-y-1">
                  {field.options.map((option, idx) => (
                    <li key={idx} className="text-gray-700 dark:text-gray-300">• {option}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        {field.fieldType === 'checkbox' && (
          <div className="space-y-2">
            {field.options.length > 0 ? (
              field.options.map((option, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <input type="checkbox" disabled className="rounded" />
                  <Label className="text-sm">{option}</Label>
                </div>
              ))
            ) : (
              <div className="flex items-center space-x-2">
                <input type="checkbox" disabled className="rounded" />
                <Label className="text-sm text-gray-500">No options added</Label>
              </div>
            )}
          </div>
        )}
        
        {field.fieldType === 'radio' && (
          <div className="space-y-2">
            {field.options.length > 0 ? (
              field.options.map((option, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <input type="radio" disabled name={field.id} className="rounded-full" />
                  <Label className="text-sm">{option}</Label>
                </div>
              ))
            ) : (
              <div className="flex items-center space-x-2">
                <input type="radio" disabled className="rounded-full" />
                <Label className="text-sm text-gray-500">No options added</Label>
              </div>
            )}
          </div>
        )}
        
        {field.fieldType === 'terms_and_conditions' && (
          <div className="flex items-start space-x-2">
            <input type="checkbox" disabled className="mt-1 rounded" />
            <div className="text-sm text-gray-700 dark:text-gray-300">
              {(() => {
                const text = field.textContent || 'By checking this box and submitting this form, I agree to the terms and conditions listed here.';
                const linkText = 'listed here';
                const linkIndex = text.indexOf(linkText);
                
                if (linkIndex === -1 || !field.linkUrl) {
                  return <span>{text}</span>;
                }
                
                const beforeLink = text.substring(0, linkIndex);
                const afterLink = text.substring(linkIndex + linkText.length);
                
                return (
                  <span>
                    {beforeLink}
                    <a 
                      href={field.linkUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {linkText}
                    </a>
                    {afterLink}
                  </span>
                );
              })()}
            </div>
          </div>
        )}
        
        {field.fieldType === 'button' && (
          <div className={`flex ${
            field.buttonAlignment === 'center' ? 'justify-center' : 
            field.buttonAlignment === 'right' ? 'justify-end' : 
            'justify-start'
          }`}>
            <Button 
              disabled 
              style={{
                backgroundColor: field.buttonBgColor || '#EAB308',
                color: field.buttonTextColor || '#000000',
                fontSize: `${field.buttonFontSize || 16}px`,
                opacity: 1
              }}
              className="font-semibold pointer-events-none"
            >
              {field.label || 'Submit'}
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Show loading state when fetching template data in edit mode
  if (isEditMode && isLoadingTemplate) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading template data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <Button
              variant="ghost"
              onClick={handleExit}
              className="p-2"
              data-testid="button-exit-form-builder"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <Input
                value={formTemplate.name}
                onChange={(e) => setFormTemplate({ ...formTemplate, name: e.target.value })}
                className="text-xl font-semibold border-none bg-transparent px-0 focus:ring-0 focus:border-none w-full"
                placeholder="Form Name"
                data-testid="input-form-name"
              />
              <p className="text-sm text-gray-500">
                {formFields.length} field{formFields.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 flex-shrink-0">
            <Button variant="outline" data-testid="button-preview-form">
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saveFormTemplateMutation.isPending}
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
              data-testid="button-save-form"
            >
              {saveFormTemplateMutation.isPending ? 'Saving...' : 'Save Form'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main content - 3 panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Form Elements */}
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Form Element</h3>
              
              {/* Quick Add Tab (active by default) */}
              <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                <button className="pb-2 border-b-2 border-blue-500 text-blue-600 font-medium">
                  Quick Add
                </button>
              </div>
            </div>

            {/* Text Elements */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Text</h4>
              <div className="grid grid-cols-3 gap-2">
                {formElements.text.map((element) => (
                  <button
                    key={element.type}
                    onClick={() => addField(element.type)}
                    className="flex flex-col items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                    data-testid={`add-field-${element.type}`}
                  >
                    <div className="text-2xl mb-1">{element.icon}</div>
                    <span className="text-xs text-center text-gray-600 dark:text-gray-400">
                      {element.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Choice Elements */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Choice Elements</h4>
              <div className="grid grid-cols-3 gap-2">
                {formElements.choice.map((element) => (
                  <button
                    key={element.type}
                    onClick={() => addField(element.type)}
                    className="flex flex-col items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                    data-testid={`add-field-${element.type}`}
                  >
                    <div className="text-2xl mb-1">{element.icon}</div>
                    <span className="text-xs text-center text-gray-600 dark:text-gray-400">
                      {element.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Other Elements */}
            <div>
              <div className="grid grid-cols-3 gap-2">
                {formElements.other.map((element) => (
                  <button
                    key={element.type}
                    onClick={() => addField(element.type)}
                    className="flex flex-col items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                    data-testid={`add-field-${element.type}`}
                  >
                    <div className="text-2xl mb-1">{element.icon}</div>
                    <span className="text-xs text-center text-gray-600 dark:text-gray-400">
                      {element.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Center Panel - Form Preview */}
        <div className="flex-1 bg-gray-100 dark:bg-gray-900 p-8 overflow-y-auto h-full">
          <div className="max-w-2xl mx-auto">
            <Card className="bg-white dark:bg-gray-800 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                  {formTemplate.name}
                </CardTitle>
                {formTemplate.description && (
                  <p className="text-gray-600 dark:text-gray-400">{formTemplate.description}</p>
                )}
              </CardHeader>
              <CardContent>
                {formFields.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <div className="text-4xl mb-4">📝</div>
                    <h3 className="text-lg font-medium mb-2">No fields added yet</h3>
                    <p className="text-sm">Click on form elements from the left panel to add fields</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formFields.map((field, index) => renderFormField(field, index))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Panel - Field Settings */}
        <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-6 overflow-y-auto h-full">
          {selectedField ? (
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">General Settings</h3>
              </div>

              <Separator />

              {/* Label */}
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  {selectedField.fieldType === 'button' ? 'Button Text' : 'Label'}
                </Label>
                <Input
                  value={selectedField.label}
                  onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                  placeholder={selectedField.fieldType === 'button' ? 'Submit' : 'Field Label'}
                  data-testid="input-field-label"
                />
              </div>

              {/* Label Alignment - Hide for button */}
              {selectedField.fieldType !== 'button' && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Label Alignment</Label>
                  <div className="flex space-x-1">
                    {['left', 'center', 'right'].map((align) => (
                      <Button
                        key={align}
                        variant={selectedField.labelAlignment === align ? "default" : "outline"}
                        size="sm"
                        onClick={() => updateField(selectedField.id, { labelAlignment: align as any })}
                        className="flex-1"
                      >
                        {align === 'left' && '←'}
                        {align === 'center' && '↔'}
                        {align === 'right' && '→'}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Placeholder - Hide for button */}
              {selectedField.fieldType !== 'button' && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Placeholder</Label>
                  <Input
                    value={selectedField.placeholder || ''}
                    onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                    placeholder="Enter placeholder text..."
                    data-testid="input-field-placeholder"
                  />
                </div>
              )}

              {/* Short Label - Hide for button */}
              {selectedField.fieldType !== 'button' && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Short Label</Label>
                  <Input
                    value={selectedField.shortLabel || ''}
                    onChange={(e) => updateField(selectedField.id, { shortLabel: e.target.value })}
                    placeholder="Short label"
                  />
                </div>
              )}

              {/* Query Key - Hide for button */}
              {selectedField.fieldType !== 'button' && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Query Key</Label>
                  <Input
                    value={selectedField.queryKey || ''}
                    onChange={(e) => updateField(selectedField.id, { queryKey: e.target.value })}
                    placeholder="query_key"
                  />
                </div>
              )}

              {/* Field Width */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Field Width</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    type="number"
                    value={selectedField.fieldWidth || 100}
                    onChange={(e) => updateField(selectedField.id, { fieldWidth: parseInt(e.target.value) })}
                    className="flex-1"
                    min="10"
                    max="100"
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>

              {/* Required - Hide for button */}
              {selectedField.fieldType !== 'button' && (
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Required</Label>
                  <Switch
                    checked={selectedField.required}
                    onCheckedChange={(checked) => updateField(selectedField.id, { required: checked })}
                    data-testid="switch-field-required"
                  />
                </div>
              )}

              {/* Hidden - Hide for button */}
              {selectedField.fieldType !== 'button' && (
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Hidden</Label>
                  <Switch
                    checked={selectedField.hidden || false}
                    onCheckedChange={(checked) => updateField(selectedField.id, { hidden: checked })}
                  />
                </div>
              )}

              {/* Options for choice fields */}
              {(selectedField.fieldType === 'single_dropdown' || 
                selectedField.fieldType === 'multi_dropdown' || 
                selectedField.fieldType === 'checkbox' || 
                selectedField.fieldType === 'radio') && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Options</Label>
                  <div className="space-y-2">
                    {selectedField.options.map((option, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Input
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...selectedField.options];
                            newOptions[index] = e.target.value;
                            updateField(selectedField.id, { options: newOptions });
                          }}
                          placeholder={`Option ${index + 1}`}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newOptions = selectedField.options.filter((_, i) => i !== index);
                            updateField(selectedField.id, { options: newOptions });
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newOptions = [...selectedField.options, ''];
                        updateField(selectedField.id, { options: newOptions });
                      }}
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Option
                    </Button>
                  </div>
                </div>
              )}

              {/* Text Content for Terms and Conditions */}
              {selectedField.fieldType === 'terms_and_conditions' && (
                <>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Text Content</Label>
                    <Textarea
                      value={selectedField.textContent || ''}
                      onChange={(e) => updateField(selectedField.id, { textContent: e.target.value })}
                      placeholder="Enter the terms and conditions text..."
                      rows={6}
                      className="resize-none"
                      data-testid="textarea-text-content"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This text will appear next to the checkbox. Include "listed here" in the text to create a hyperlink.
                    </p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Link URL</Label>
                    <Input
                      value={selectedField.linkUrl || ''}
                      onChange={(e) => updateField(selectedField.id, { linkUrl: e.target.value })}
                      placeholder="https://example.com/terms"
                      data-testid="input-link-url"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      URL for the "listed here" hyperlink. Leave empty to display text without a link.
                    </p>
                  </div>
                </>
              )}

              {/* Button Styling Options */}
              {selectedField.fieldType === 'button' && (
                <>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Font Size</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        value={selectedField.buttonFontSize || 16}
                        onChange={(e) => updateField(selectedField.id, { buttonFontSize: parseInt(e.target.value) })}
                        className="flex-1"
                        min="10"
                        max="32"
                      />
                      <span className="text-sm text-gray-500">px</span>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Alignment</Label>
                    <div className="flex space-x-1">
                      {['left', 'center', 'right'].map((align) => (
                        <Button
                          key={align}
                          variant={selectedField.buttonAlignment === align ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateField(selectedField.id, { buttonAlignment: align as any })}
                          className="flex-1"
                        >
                          {align === 'left' && '←'}
                          {align === 'center' && '↔'}
                          {align === 'right' && '→'}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Background Color</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="color"
                        value={selectedField.buttonBgColor || '#EAB308'}
                        onChange={(e) => updateField(selectedField.id, { buttonBgColor: e.target.value })}
                        className="w-16 h-10"
                      />
                      <Input
                        type="text"
                        value={selectedField.buttonBgColor || '#EAB308'}
                        onChange={(e) => updateField(selectedField.id, { buttonBgColor: e.target.value })}
                        placeholder="#EAB308"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-2 block">Text Color</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="color"
                        value={selectedField.buttonTextColor || '#000000'}
                        onChange={(e) => updateField(selectedField.id, { buttonTextColor: e.target.value })}
                        className="w-16 h-10"
                      />
                      <Input
                        type="text"
                        value={selectedField.buttonTextColor || '#000000'}
                        onChange={(e) => updateField(selectedField.id, { buttonTextColor: e.target.value })}
                        placeholder="#000000"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No field selected</h3>
              <p className="text-sm">Click on a field in the form to edit its settings</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}