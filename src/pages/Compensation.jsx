import React, { useState } from "react";
import { gqlClient } from "@/api/graphqlClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus, Settings2, Users } from "lucide-react";

export default function Compensation() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("structures");
  const [showStructureDialog, setShowStructureDialog] = useState(false);
  
  const [structureForm, setStructureForm] = useState({
    name: '',
    effectiveDate: new Date().toISOString().slice(0, 10),
    basic: 0,
    housing: 0,
    transport: 0,
    tax: 0,
    pension: 0
  });

  const { data: structures = [], isLoading: structuresLoading } = useQuery({
    queryKey: ['compensation-structures'],
    queryFn: async () => {
      const QUERY = `
        query {
          compensationStructures {
            id name effectiveDate components status createdAt
          }
        }
      `;
      const data = await gqlClient.request(QUERY);
      return data.compensationStructures || [];
    }
  });

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['employees-compensation'],
    queryFn: async () => {
      const QUERY = `
        query {
          employees {
            id fullName department { name } jobTitle employeeCode
          }
        }
      `;
      const data = await gqlClient.request(QUERY);
      return data.employees || [];
    }
  });

  const createStructureMutation = useMutation({
    mutationFn: async (input) => {
      const components = {
        earnings: {
          basic: Number(input.basic),
          housing: Number(input.housing),
          transport: Number(input.transport)
        },
        deductions: {
          tax: Number(input.tax),
          pension: Number(input.pension)
        }
      };

      const MUTATION = `
        mutation CreateStruct($input: CompensationStructureInput!) {
          createCompensationStructure(input: $input) { id name }
        }
      `;
      await gqlClient.request(MUTATION, { 
        input: {
          name: input.name,
          effectiveDate: input.effectiveDate,
          components
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['compensation-structures']);
      setShowStructureDialog(false);
      toast.success("Compensation Structure Created");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to create structure");
    }
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Compensation Management</h1>
            <p className="text-slate-600">Define salary structures and assign them to employees.</p>
          </div>
          
          <Dialog open={showStructureDialog} onOpenChange={setShowStructureDialog}>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 text-white">
                <Plus className="w-4 h-4 mr-2" /> New Structure
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Create Compensation Structure</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Structure Name</Label>
                  <Input value={structureForm.name} onChange={e => setStructureForm({...structureForm, name: e.target.value})} placeholder="e.g. Senior Engineering Band" />
                </div>
                <div className="space-y-2">
                  <Label>Effective Date</Label>
                  <Input type="date" value={structureForm.effectiveDate} onChange={e => setStructureForm({...structureForm, effectiveDate: e.target.value})} />
                </div>
                
                <h3 className="font-semibold text-slate-800 mt-4 border-b pb-2">Earnings (Yearly NGN)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Basic Salary</Label>
                    <Input type="number" value={structureForm.basic} onChange={e => setStructureForm({...structureForm, basic: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Housing Allowance</Label>
                    <Input type="number" value={structureForm.housing} onChange={e => setStructureForm({...structureForm, housing: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Transport Allowance</Label>
                    <Input type="number" value={structureForm.transport} onChange={e => setStructureForm({...structureForm, transport: e.target.value})} />
                  </div>
                </div>

                <h3 className="font-semibold text-slate-800 mt-4 border-b pb-2">Deductions (Yearly NGN)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estimated Tax (PAYE)</Label>
                    <Input type="number" value={structureForm.tax} onChange={e => setStructureForm({...structureForm, tax: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Pension Deduction</Label>
                    <Input type="number" value={structureForm.pension} onChange={e => setStructureForm({...structureForm, pension: e.target.value})} />
                  </div>
                </div>

                <Button 
                  onClick={() => createStructureMutation.mutate(structureForm)}
                  disabled={createStructureMutation.isPending || !structureForm.name}
                  className="w-full mt-4 bg-slate-900"
                >
                  {createStructureMutation.isPending ? 'Saving...' : 'Save Structure'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border w-full justify-start h-12 rounded-lg p-1">
            <TabsTrigger value="structures" className="data-[state=active]:bg-slate-100 rounded-md px-6">
              <Settings2 className="w-4 h-4 mr-2" />
              Structures
            </TabsTrigger>
            <TabsTrigger value="assignments" className="data-[state=active]:bg-slate-100 rounded-md px-6">
              <Users className="w-4 h-4 mr-2" />
              Employee Assignments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="structures">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead>Total Earnings</TableHead>
                    <TableHead>Total Deductions</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {structuresLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                  ) : structures.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8">No structures found.</TableCell></TableRow>
                  ) : (
                    structures.map(struct => {
                      const earnings = struct.components?.earnings || {};
                      const deductions = struct.components?.deductions || {};
                      const totalEarn = Object.values(earnings).reduce((a, b) => Number(a) + Number(b), 0);
                      const totalDed = Object.values(deductions).reduce((a, b) => Number(a) + Number(b), 0);

                      return (
                        <TableRow key={struct.id}>
                          <TableCell className="font-semibold">{struct.name}</TableCell>
                          <TableCell>{format(new Date(struct.effectiveDate), 'MMM d, yyyy')}</TableCell>
                          <TableCell className="text-green-600 font-medium">{totalEarn.toLocaleString()} NGN</TableCell>
                          <TableCell className="text-red-600 font-medium">{totalDed.toLocaleString()} NGN</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-green-50 text-green-700">{struct.status}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="assignments">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeesLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8">Loading...</TableCell></TableRow>
                  ) : (
                    employees.map(emp => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">
                          <div>{emp.fullName}</div>
                          <div className="text-xs text-slate-500">{emp.employeeCode}</div>
                        </TableCell>
                        <TableCell>{emp.department?.name || 'N/A'}</TableCell>
                        <TableCell>{emp.jobTitle}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm">Assign Structure</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
