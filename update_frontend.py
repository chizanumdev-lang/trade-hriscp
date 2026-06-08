import re

def main():
    with open('src/pages/PendingApprovals.jsx', 'r') as f:
        content = f.read()

    # Add RejectDialog component
    reject_dialog = """
const RejectDialog = ({ onReject, title = "Reject Request" }) => {
  const [reason, setReason] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const handleReject = () => {
    if (!reason.trim()) return;
    onReject(reason);
    setOpen(false);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2">
          <XCircle className="w-4 h-4" />
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Reason for rejection (Required)</label>
            <textarea
              className="w-full min-h-[100px] p-3 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Please provide a reason..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!reason.trim()} 
              onClick={handleReject}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function PendingApprovals() {"""
    
    content = content.replace("export default function PendingApprovals() {", reject_dialog)

    # Update REJECT_LEAVE
    reject_leave_new = """const REJECT_LEAVE = gql`
  mutation RejectLeave($id: ID!, $reason: String!) {
    rejectLeaveRequest(id: $id, reason: $reason) {
      id
      status
    }
  }
`;"""
    content = re.sub(r'const REJECT_LEAVE = gql`\n  mutation RejectLeave\(\$id: ID!\) \{\n    rejectLeaveRequest\(id: \$id\) \{\n      id\n      status\n    \}\n  \}\n`;', reject_leave_new, content)

    # Update REJECT_PROFILE
    reject_profile_new = """const REJECT_PROFILE = gql`
  mutation RejectProfile($id: ID!, $reason: String!) {
    rejectProfileUpdateRequest(id: $id, reason: $reason) {
      id
      status
    }
  }
`;"""
    content = re.sub(r'const REJECT_PROFILE = gql`\n  mutation RejectProfile\(\$id: ID!\) \{\n    rejectProfileUpdateRequest\(id: \$id\) \{\n      id\n      status\n    \}\n  \}\n`;', reject_profile_new, content)


    # Replace Document Reject Button
    doc_btn_old = """                        <Button 
                          variant="outline" 
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2"
                          onClick={() => rejectDocument({ id: doc.id })}
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </Button>"""
    doc_btn_new = """                        <RejectDialog onReject={(reason) => rejectDocument({ id: doc.id, reason })} title={`Reject Document: ${doc.name}`} />"""
    content = content.replace(doc_btn_old, doc_btn_new)


    # Replace Leave Reject Button
    leave_btn_old = """                        <Button 
                          variant="outline" 
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2"
                          onClick={() => rejectLeave({ id: leave.id })}
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </Button>"""
    leave_btn_new = """                        <RejectDialog onReject={(reason) => rejectLeave({ id: leave.id, reason })} title="Reject Leave Request" />"""
    content = content.replace(leave_btn_old, leave_btn_new)


    # Replace Profile Reject Button
    profile_btn_old = """                        <Button 
                          variant="outline" 
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2"
                          onClick={() => rejectProfile({ id: update.id })}
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </Button>"""
    profile_btn_new = """                        <RejectDialog onReject={(reason) => rejectProfile({ id: update.id, reason })} title="Reject Profile Update" />"""
    content = content.replace(profile_btn_old, profile_btn_new)


    with open('src/pages/PendingApprovals.jsx', 'w') as f:
        f.write(content)

if __name__ == '__main__':
    main()
