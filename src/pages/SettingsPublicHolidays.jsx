import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { gql } from 'graphql-request';
import { gqlClient } from '@/api/graphqlClient';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

const GET_PUBLIC_HOLIDAYS = gql`
  query GetPublicHolidays($year: Int!) {
    publicHolidays(year: $year) {
      id
      name
      date
    }
  }
`;

const CREATE_PUBLIC_HOLIDAY = gql`
  mutation CreatePublicHoliday($input: PublicHolidayInput!) {
    createPublicHoliday(input: $input) {
      id
      name
      date
    }
  }
`;

const DELETE_PUBLIC_HOLIDAY = gql`
  mutation DeletePublicHoliday($id: ID!) {
    deletePublicHoliday(id: $id)
  }
`;

export default function SettingsPublicHolidays() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    date: ''
  });

  const { data, isLoading } = useQuery({
    queryKey: ['publicHolidays', selectedYear],
    queryFn: () => gqlClient.request(GET_PUBLIC_HOLIDAYS, { year: selectedYear })
  });

  const { mutate: createHoliday, isPending: isCreating } = useMutation({
    mutationFn: (variables) => gqlClient.request(CREATE_PUBLIC_HOLIDAY, variables),
    onSuccess: () => {
      toast.success("Public Holiday added successfully!");
      queryClient.invalidateQueries(['publicHolidays']);
      setIsAdding(false);
      setFormData({ name: '', date: '' });
    },
    onError: (err) => {
      toast.error(err.response?.errors?.[0]?.message || "Failed to add holiday.");
    }
  });

  const { mutate: deleteHoliday, isPending: isDeleting } = useMutation({
    mutationFn: (id) => gqlClient.request(DELETE_PUBLIC_HOLIDAY, { id }),
    onSuccess: () => {
      toast.success("Public Holiday removed!");
      queryClient.invalidateQueries(['publicHolidays']);
    },
    onError: (err) => toast.error("Failed to remove holiday.")
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.date) return toast.error("Name and Date are required");
    createHoliday({ input: formData });
  };

  const holidays = data?.publicHolidays || [];
  const sortedHolidays = [...holidays].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Public Holidays</h2>
          <p className="text-slate-500 mt-1">Manage statutory holidays. These dates are automatically excluded from leave deductions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSelectedYear(y => y - 1)}>&larr;</Button>
          <span className="font-semibold px-4">{selectedYear}</span>
          <Button variant="outline" onClick={() => setSelectedYear(y => y + 1)}>&rarr;</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {isLoading ? (
            <Card><CardContent className="p-8 text-center text-slate-500">Loading holidays...</CardContent></Card>
          ) : sortedHolidays.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-slate-500">No public holidays configured for {selectedYear}.</CardContent></Card>
          ) : (
            sortedHolidays.map(h => (
              <motion.div key={h.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{h.name}</h4>
                        <p className="text-sm text-slate-500 mt-1">
                          {new Date(h.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        if(confirm('Are you sure you want to remove this holiday?')) deleteHoliday(h.id);
                      }}
                      disabled={isDeleting}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        <div>
          {isAdding ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Holiday</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Holiday Name</label>
                    <Input 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="e.g. New Year's Day"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Date</label>
                    <Input 
                      type="date"
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAdding(false)}>Cancel</Button>
                    <Button type="submit" className="flex-1" disabled={isCreating}>Save</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Button onClick={() => setIsAdding(true)} className="w-full flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Holiday
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
