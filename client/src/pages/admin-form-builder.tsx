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
import { useAdminAuth } from "@/hooks/useAdminAuth";
import type { Company } from "@shared/schema";

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
  companyId: number;
}

export default function AdminFormBuilderPage() {
  const [, setLocation] = useLocation();
  const params = useParams();
  const { admin, isAdminAuthenticated, isLoading: authLoading } = useAdminAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const token = localStorage.getItem('adminToken');

  // Determine if we're in edit mode
  const isEditMode = !!params.templateId;
  const templateId = params.templateId;
  const companyIdFromUrl = params.companyId;

  // Form template state
  const [formTemplate, setFormTemplate] = useState<FormTemplate>({
    name: "Untitled Form",
    description: "",
    isActive: true,
    companyId: companyIdFromUrl ? parseInt(companyIdFromUrl) : 0,
  });

  // Form fields state
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null);

  // Fetch companies for the dropdown
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/admin/companies"],
    queryFn: async () => {
      const response = await fetch('/api/admin/companies', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch companies');
      return response.json();
    },
  });

  // Fetch existing template data when in edit mode
  const { data: existingTemplate, isLoading: isLoadingTemplate } = useQuery({
    queryKey: ['/api/admin/form-templates', templateId],
    queryFn: async () => {
      if (!templateId) return null;
      
      const response = await fetch(`/api/admin/form-templates/${templateId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch template');
      const templateData = await response.json();
      
      // Also fetch the fields for this template
      const fieldsResponse = await fetch(`/api/admin/form-templates/${templateId}/fields`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const fieldsData = fieldsResponse.ok ? await fieldsResponse.json() : [];
      
      return { template: templateData, fields: fieldsData };
    },
    enabled: isEditMode && !!templateId
  });

  // Preload form data when editing existing template
  useEffect(() => {
    if (existingTemplate) {
      setFormTemplate({
        id: existingTemplate.template.id,
        name: existingTemplate.template.name,
        description: existingTemplate.template.description || "",
        isActive: existingTemplate.template.isActive,
        companyId: existingTemplate.template.companyId
      });

      const fieldsWithStringIds = existingTemplate.fields.map((field: any) => ({
        ...field,
        id: `field_${field.id}`,
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

  // Set company ID from URL param when creating new template
  useEffect(() => {
    if (!isEditMode && companyIdFromUrl) {
      setFormTemplate(prev => ({
        ...prev,
        companyId: parseInt(companyIdFromUrl)
      }));
    }
  }, [companyIdFromUrl, isEditMode]);

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
      linkUrl: fieldType === 'terms_and_conditions' ? '' : undefined,
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
        const templateResponse = await fetch(`/api/admin/form-templates/${templateId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(templateData),
        });
        if (!templateResponse.ok) throw new Error('Failed to update template');
        templateResult = await templateResponse.json();
        
        // Delete existing fields first
        await fetch(`/api/admin/form-templates/${templateId}/fields`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        // Create new/updated fields
        for (const field of fields) {
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
          
          await fetch(`/api/admin/form-templates/${templateId}/fields`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(fieldData),
          });
        }
      } else {
        // Create new template
        const templateResponse = await fetch('/api/admin/form-templates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(templateData),
        });
        
        if (!templateResponse.ok) throw new Error('Failed to create template');
        templateResult = await templateResponse.json();
        
        // Create fields for the new template
        for (const field of fields) {
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
          
          await fetch(`/api/admin/form-templates/${templateResult.id}/fields`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(fieldData),
          });
        }
      }
      
      return templateResult;
    },
    onSuccess: (data) => {
      toast({
        title: "Form Template Saved",
        description: `"${formTemplate.name}" has been ${isEditMode ? 'updated' : 'created'} successfully with ${formFields.length} fields.`,
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/form-templates', templateId] });
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

    if (!formTemplate.companyId) {
      toast({
        title: "Error",
        description: "Please select a company for this form template.",
        variant: "destructive",
      });
      return;
    }

    const templateData = {
      name: formTemplate.name.trim(),
      description: formTemplate.description?.trim() || null,
      isActive: formTemplate.isActive,
      companyId: formTemplate.companyId.toString(),
    };

    saveFormTemplateMutation.mutate({ templateData, fields: formFields });
  };

  const handleExit = () => {
    setLocation('/admin/dashboard');
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

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAdminAuthenticated) {
      setLocation("/admin");
    }
  }, [authLoading, isAdminAuthenticated, setLocation]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

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
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <Input
                value={formTemplate.name}
                onChange={(e) => setFormTemplate({ ...formTemplate, name: e.target.value })}
                className="text-xl font-semibold border-none bg-transparent px-0 focus:ring-0 focus:border-none w-full"
                placeholder="Form Name"
              />
              <p className="text-sm text-gray-500">
                {formFields.length} field{formFields.length !== 1 ? 's' : ''} | Admin Form Builder
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 flex-shrink-0">
            <Button variant="outline">
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button 
              onClick={handleSave}
              disabled={saveFormTemplateMutation.isPending}
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
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
              {/* Company Selector (for new templates) */}
              {!isEditMode && (
                <div className="space-y-2">
                  <Label>Company *</Label>
                  <Select 
                    value={formTemplate.companyId?.toString() || ""} 
                    onValueChange={(value) => setFormTemplate({ ...formTemplate, companyId: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id.toString()}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isEditMode && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <Label className="text-sm text-amber-800 dark:text-amber-200">Company</Label>
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    {companies.find(c => c.id === formTemplate.companyId)?.name || 'Loading...'}
                  </p>
                </div>
              )}

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Form Elements</h3>
                
                <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
                  <button className="pb-2 border-b-2 border-blue-500 text-blue-600 font-medium">
                    Quick Add
                  </button>
                </div>
                
                {/* Text Elements */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase mb-2">Text</p>
                  <div className="grid grid-cols-2 gap-2">
                    {formElements.text.map((element) => (
                      <button
                        key={element.type}
                        onClick={() => addField(element.type)}
                        className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors"
                      >
                        <span className="block text-lg mb-1">{element.icon}</span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">{element.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Choice Elements */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500 uppercase mb-2">Choice</p>
                  <div className="grid grid-cols-2 gap-2">
                    {formElements.choice.map((element) => (
                      <button
                        key={element.type}
                        onClick={() => addField(element.type)}
                        className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors"
                      >
                        <span className="block text-lg mb-1">{element.icon}</span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">{element.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Other Elements */}
                <div>
                  <p className="text-xs text-gray-500 uppercase mb-2">Other</p>
                  <div className="grid grid-cols-2 gap-2">
                    {formElements.other.map((element) => (
                      <button
                        key={element.type}
                        onClick={() => addField(element.type)}
                        className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors"
                      >
                        <span className="block text-lg mb-1">{element.icon}</span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">{element.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center Panel - Form Preview */}
        <div className="flex-1 bg-gray-100 dark:bg-gray-900 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-8">
            <Card>
              <CardHeader>
                <CardTitle>{formTemplate.name || 'Untitled Form'}</CardTitle>
                {formTemplate.description && (
                  <p className="text-sm text-gray-500">{formTemplate.description}</p>
                )}
              </CardHeader>
              <CardContent>
                {formFields.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Plus className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">Start building your form</p>
                    <p className="text-sm">Click on elements from the left panel to add them</p>
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

        {/* Right Panel - Field Properties */}
        <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
          <div className="p-6">
            {selectedField ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Field Properties</h3>
                  <Settings className="w-5 h-5 text-gray-400" />
                </div>
                
                <div className="space-y-4">
                  {/* Label */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Label</Label>
                    <Input
                      value={selectedField.label}
                      onChange={(e) => updateField(selectedField.id, { label: e.target.value })}
                      placeholder="Field label"
                    />
                  </div>
                  
                  {/* Placeholder (for text fields) */}
                  {(selectedField.fieldType === 'single_text' || selectedField.fieldType === 'multi_text' || selectedField.fieldType === 'text_list') && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Placeholder</Label>
                      <Input
                        value={selectedField.placeholder || ''}
                        onChange={(e) => updateField(selectedField.id, { placeholder: e.target.value })}
                        placeholder="Enter placeholder text..."
                      />
                    </div>
                  )}
                  
                  {/* Short Label - Hide for button */}
                  {selectedField.fieldType !== 'button' && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Short Label</Label>
                      <Input
                        value={selectedField.shortLabel || ''}
                        onChange={(e) => updateField(selectedField.id, { shortLabel: e.target.value })}
                        placeholder="Short label"
                      />
                    </div>
                  )}

                  {/* Query Key - Hide for button */}
                  {selectedField.fieldType !== 'button' && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Query Key</Label>
                      <Input
                        value={selectedField.queryKey || ''}
                        onChange={(e) => updateField(selectedField.id, { queryKey: e.target.value })}
                        placeholder="query_key"
                      />
                    </div>
                  )}

                  {/* Field Width */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Field Width</Label>
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
                  
                  {/* Required toggle */}
                  {selectedField.fieldType !== 'button' && (
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Required</Label>
                      <Switch
                        checked={selectedField.required}
                        onCheckedChange={(checked) => updateField(selectedField.id, { required: checked })}
                      />
                    </div>
                  )}

                  {/* Hidden toggle - Hide for button */}
                  {selectedField.fieldType !== 'button' && (
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Hidden</Label>
                      <Switch
                        checked={selectedField.hidden || false}
                        onCheckedChange={(checked) => updateField(selectedField.id, { hidden: checked })}
                      />
                    </div>
                  )}
                  
                  {/* Options for choice fields - with individual inputs and delete buttons */}
                  {(selectedField.fieldType === 'single_dropdown' || 
                    selectedField.fieldType === 'multi_dropdown' || 
                    selectedField.fieldType === 'checkbox' || 
                    selectedField.fieldType === 'radio') && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Options</Label>
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
                  
                  {/* Terms content */}
                  {selectedField.fieldType === 'terms_and_conditions' && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Text Content</Label>
                        <Textarea
                          value={selectedField.textContent || ''}
                          onChange={(e) => updateField(selectedField.id, { textContent: e.target.value })}
                          placeholder="Enter the terms and conditions text..."
                          rows={6}
                          className="resize-none"
                        />
                        <p className="text-xs text-gray-500">
                          This text will appear next to the checkbox. Include "listed here" in the text to create a hyperlink.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Link URL</Label>
                        <Input
                          value={selectedField.linkUrl || ''}
                          onChange={(e) => updateField(selectedField.id, { linkUrl: e.target.value })}
                          placeholder="https://example.com/terms"
                        />
                        <p className="text-xs text-gray-500">
                          URL for the "listed here" hyperlink. Leave empty to display text without a link.
                        </p>
                      </div>
                    </>
                  )}
                  
                  {/* Button properties */}
                  {selectedField.fieldType === 'button' && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Font Size</Label>
                        <Input
                          type="number"
                          value={selectedField.buttonFontSize || 16}
                          onChange={(e) => updateField(selectedField.id, { buttonFontSize: parseInt(e.target.value) })}
                          min={12}
                          max={24}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Alignment</Label>
                        <Select
                          value={selectedField.buttonAlignment || 'left'}
                          onValueChange={(value) => updateField(selectedField.id, { buttonAlignment: value as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="left">Left</SelectItem>
                            <SelectItem value="center">Center</SelectItem>
                            <SelectItem value="right">Right</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Background Color</Label>
                        <Input
                          type="color"
                          value={selectedField.buttonBgColor || '#EAB308'}
                          onChange={(e) => updateField(selectedField.id, { buttonBgColor: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Text Color</Label>
                        <Input
                          type="color"
                          value={selectedField.buttonTextColor || '#000000'}
                          onChange={(e) => updateField(selectedField.id, { buttonTextColor: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No field selected</p>
                <p className="text-sm">Click on a field to edit its properties</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
