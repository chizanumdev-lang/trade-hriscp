import React, { useState } from "react";
import countryList from 'country-list';
import { gqlClient } from "@/api/graphqlClient";
import { gql } from "graphql-request";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { uploadToCloudinary } from "@/utils/cloudinary";

const UPDATE_EMPLOYEE = gql`
  mutation UpdateEmployeeSelf($input: UpdateEmployeeInput!) {
    updateEmployeeSelf(input: $input) {
      id
    }
  }
`;

const GET_EMPLOYEE = gql`
  query GetEmployee($id: ID!) {
    employee(id: $id) {
      id
      phone
      workEmail
      privateEmail
      dateOfBirth
      gender
      maritalStatus
      nationality
      nationalId
      passportNumber
    }
  }
`;

const UPLOAD_DOCUMENT = gql`
  mutation UploadDocument($employeeId: ID!, $name: String!, $category: String!, $fileUrl: String!, $fileType: String!, $visibilityLevel: String!) {
    uploadDocument(employeeId: $employeeId, name: $name, category: $category, fileUrl: $fileUrl, fileType: $fileType, visibilityLevel: $visibilityLevel) {
      id
    }
  }
`;

const CLEAR_PROFILE_GATE = gql`
  mutation ClearProfileGate {
    clearProfileGate {
      id
      mustCompleteProfile
    }
  }
`;

export default function ProfileCompletionWizard() {
  const { user, checkAppState } = useAuth();
  const employeeId = user?.employeeId;
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [identityType, setIdentityType] = useState('nationalId');
  const [identityNumber, setIdentityNumber] = useState('');
  
  const [formData, setFormData] = useState({
    phone: '',
    privateEmail: '',
    dateOfBirth: '',
    gender: '',
    maritalStatus: '',
    nationality: '',
    nationalId: '',
    passportNumber: ''
  });

  const { data: employeeDataObj } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => gqlClient.request(GET_EMPLOYEE, { id: employeeId }),
    enabled: !!employeeId
  });

  React.useEffect(() => {
    if (employeeDataObj?.employee) {
      const emp = employeeDataObj.employee;
      let formattedDob = '';
      if (emp.dateOfBirth) {
        try {
          // Attempt to format dateOfBirth into YYYY-MM-DD
          const d = new Date(Number(emp.dateOfBirth) || emp.dateOfBirth);
          if (!isNaN(d.getTime())) {
            formattedDob = d.toISOString().split('T')[0];
          }
        } catch (e) {
          // Ignore date parse errors
        }
      }

      setFormData(prev => ({
        ...prev,
        phone: emp.phone || prev.phone,
        privateEmail: emp.privateEmail || prev.privateEmail,
        dateOfBirth: formattedDob || prev.dateOfBirth,
        gender: emp.gender || prev.gender,
        maritalStatus: emp.maritalStatus || prev.maritalStatus,
        nationality: emp.nationality || prev.nationality,
        nationalId: emp.nationalId || prev.nationalId,
        passportNumber: emp.passportNumber || prev.passportNumber,
      }));
    }
  }, [employeeDataObj]);

  const [documentData, setDocumentData] = useState({
    name: 'ID Document',
    category: 'Identity',
    file: null
  });

  const handleNext = () => {
    // Validate step 1
    if (step === 1) {
      if (!formData.phone || !formData.privateEmail || !formData.dateOfBirth || !formData.gender || !formData.maritalStatus || !formData.nationality) {
        toast.error("Please fill in all personal information fields");
        return;
      }
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!identityNumber) {
      toast.error("Please enter your identity document number");
      return;
    }
    if (!documentData.file) {
      toast.error("Please select a document to upload");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const finalFormData = { 
        ...formData, 
        nationalId: identityType === 'nationalId' ? identityNumber : '', 
        passportNumber: identityType === 'passport' ? identityNumber : '' 
      };

      // 1. Update Employee Profile
      await gqlClient.request(UPDATE_EMPLOYEE, { input: finalFormData });
      
      // 2. Upload Document to Cloudinary
      const uploadResult = await uploadToCloudinary(documentData.file);
      if (!uploadResult || !uploadResult.secure_url) {
        console.error("Cloudinary uploadResult:", uploadResult);
        throw new Error("Failed to upload document to cloud storage: missing secure_url");
      }
      
      // 3. Save Document Record
      await gqlClient.request(UPLOAD_DOCUMENT, {
        employeeId,
        name: documentData.name,
        category: documentData.category,
        fileUrl: uploadResult.secure_url,
        fileType: documentData.file.name.split('.').pop() || 'pdf',
        visibilityLevel: 'employee'
      });
      
      // 4. Clear the gate
      await gqlClient.request(CLEAR_PROFILE_GATE);
      
      toast.success("Profile completed successfully!");
      
      // Re-fetch user data so App.jsx redirects to Dashboard
      await checkAppState();
      
    } catch (error) {
      console.error(error);
      toast.error("Failed to complete profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Welcome to Tradevu!</h1>
          <p className="text-slate-600 mt-2">Please complete your employee profile to get started.</p>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-500">Step {step} of 2</span>
              <div className="flex gap-1">
                {[1, 2].map(i => (
                  <div key={i} className={`h-2 w-16 rounded-full ${i <= step ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                ))}
              </div>
            </div>
            <CardTitle>{step === 1 ? 'Personal Information' : 'Identity Verification'}</CardTitle>
            <CardDescription>
              {step === 1 ? 'Please provide your basic contact and demographic details.' 
               : 'Please select an identity document type, provide its number, and upload a clear copy.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {step === 1 && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Private Email <span className="text-red-500">*</span></Label>
                  <Input 
                    type="email" 
                    value={formData.privateEmail} 
                    onChange={e => setFormData(p => ({...p, privateEmail: e.target.value}))} 
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number <span className="text-red-500">*</span></Label>
                  <Input 
                    value={formData.phone} 
                    onChange={e => setFormData(p => ({...p, phone: e.target.value}))} 
                    placeholder="+1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth <span className="text-red-500">*</span></Label>
                  <Input 
                    type="date" 
                    value={formData.dateOfBirth} 
                    onChange={e => setFormData(p => ({...p, dateOfBirth: e.target.value}))} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender <span className="text-red-500">*</span></Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                    value={formData.gender}
                    onChange={e => setFormData(p => ({...p, gender: e.target.value}))}
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Marital Status <span className="text-red-500">*</span></Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                    value={formData.maritalStatus}
                    onChange={e => setFormData(p => ({...p, maritalStatus: e.target.value}))}
                  >
                    <option value="">Select Status</option>
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Nationality <span className="text-red-500">*</span></Label>
                  <select 
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                    value={formData.nationality}
                    onChange={e => setFormData(p => ({...p, nationality: e.target.value}))}
                  >
                    <option value="">Select Nationality</option>
                    {countryList.getNames().map(country => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Document Type <span className="text-red-500">*</span></Label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                      value={identityType}
                      onChange={e => setIdentityType(e.target.value)}
                    >
                      <option value="nationalId">National ID (NIN)</option>
                      <option value="passport">Passport</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Document Number <span className="text-red-500">*</span></Label>
                    <Input 
                      value={identityNumber} 
                      onChange={e => setIdentityNumber(e.target.value)} 
                      placeholder={identityType === 'nationalId' ? 'Enter NIN' : 'Enter Passport Number'}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Upload Document <span className="text-red-500">*</span></Label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors">
                    <input
                      type="file"
                      id="document-upload"
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setDocumentData(p => ({ ...p, file }));
                        }
                      }}
                    />
                    <Label htmlFor="document-upload" className="cursor-pointer flex flex-col items-center">
                      <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">
                        {documentData.file ? documentData.file.name : "Click to select a file"}
                      </span>
                      <span className="text-xs text-slate-500 mt-1">PDF, JPG, or PNG up to 10MB</span>
                    </Label>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-6 border-t border-slate-100">
              {step > 1 ? (
                <Button variant="outline" onClick={handleBack} disabled={isSubmitting}>
                  Back
                </Button>
              ) : <div></div>}
              
              {step < 2 ? (
                <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleNext}>
                  Continue
                </Button>
              ) : (
                <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Complete Profile"}
                </Button>
              )}
            </div>
            
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
