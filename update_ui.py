import re

def update_payroll():
    with open('src/pages/Payroll.jsx', 'r') as f:
        content = f.read()

    # Add submitRunMutation
    submit_mutation = """  const submitRunMutation = useMutation({
    mutationFn: async (id) => {
      const MUTATION = `mutation SubmitRun($id: ID!) { submitPayrollRun(id: $id) { id status } }`;
      await gqlClient.request(MUTATION, { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['payroll-runs']);
      toast.success("Payroll run submitted for approval");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to submit payroll run");
    }
  });

  const approveRunMutation"""
    content = content.replace("  const approveRunMutation", submit_mutation)

    # Update approveRun check
    approve_button_old = """            {run?.status === 'DRAFT' && canApprove && (
              <Button 
                onClick={() => approveRunMutation.mutate(run.id)}
                disabled={approveRunMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {approveRunMutation.isPending ? 'Approving...' : 'Approve Run'}
              </Button>
            )}"""
    approve_button_new = """            {run?.status === 'DRAFT' && (
              <Button 
                onClick={() => submitRunMutation.mutate(run.id)}
                disabled={submitRunMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {submitRunMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
              </Button>
            )}
            {run?.status === 'PENDING_APPROVAL' && canApprove && (
              <Button 
                onClick={() => approveRunMutation.mutate(run.id)}
                disabled={approveRunMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {approveRunMutation.isPending ? 'Approving...' : 'Approve Run'}
              </Button>
            )}"""
    content = content.replace(approve_button_old, approve_button_new)

    with open('src/pages/Payroll.jsx', 'w') as f:
        f.write(content)

def update_knowledge():
    with open('src/pages/KnowledgeBank.jsx', 'r') as f:
        content = f.read()

    # Add SUBMIT_POLICY_MUTATION
    submit_mutation_gql = """const SUBMIT_POLICY_MUTATION = gql`
  mutation SubmitPolicy($id: ID!) {
    submitPolicy(id: $id) {
      id
      status
    }
  }
`;

const ACKNOWLEDGE_POLICY_MUTATION"""
    content = content.replace("const ACKNOWLEDGE_POLICY_MUTATION", submit_mutation_gql)

    # Add submitPolicyMutation hook
    submit_mutation_hook = """  const submitPolicyMutation = useMutation({
    mutationFn: async (id) => await gqlClient.request(SUBMIT_POLICY_MUTATION, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
    }
  });

  const acknowledgePolicyMutation"""
    content = content.replace("  const acknowledgePolicyMutation", submit_mutation_hook)

    # Change "Publish" to "Save Draft" in dialog
    content = content.replace('Publish Document', 'Create Document')
    content = content.replace('Publish New Document', 'Create New Document')
    content = content.replace('createPolicyMutation.isPending ? "Publishing..." : "Publish"', 'createPolicyMutation.isPending ? "Saving..." : "Save Draft"')

    # Add submit button on Policy Cards if status is DRAFT
    card_content_old = """                  <p className="text-slate-600 text-sm line-clamp-3 mb-6">
                    {policy.content || "No preview available. Click to view full document."}
                  </p>"""
    card_content_new = """                  <p className="text-slate-600 text-sm line-clamp-3 mb-6">
                    {policy.content || "No preview available. Click to view full document."}
                  </p>
                  {policy.status === 'DRAFT' && isHRAdmin && (
                    <Button 
                      variant="outline" 
                      className="w-full mb-4 text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => submitPolicyMutation.mutate(policy.id)}
                      disabled={submitPolicyMutation.isPending}
                    >
                      {submitPolicyMutation.isPending ? "Submitting..." : "Submit for Approval"}
                    </Button>
                  )}"""
    content = content.replace(card_content_old, card_content_new)

    with open('src/pages/KnowledgeBank.jsx', 'w') as f:
        f.write(content)

if __name__ == '__main__':
    update_payroll()
    update_knowledge()
