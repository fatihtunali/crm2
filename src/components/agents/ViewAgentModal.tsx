interface Agent {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  website: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ViewAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  agent: Agent | null;
}

export default function ViewAgentModal({ isOpen, onClose, onEdit, agent }: ViewAgentModalProps) {
  if (!isOpen || !agent) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'suspended': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Agent Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Agent Name</h3>
              <p className="text-lg font-semibold text-gray-900">{agent.name}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Email</h3>
              <p className="text-gray-900">{agent.email}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Phone</h3>
              <p className="text-gray-900">{agent.phone || 'N/A'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Country</h3>
              <p className="text-gray-900">{agent.country || 'N/A'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
              <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(agent.status)}`}>
                {agent.status}
              </span>
            </div>
            {agent.website && (
              <div className="col-span-2">
                <h3 className="text-sm font-medium text-gray-500 mb-1">Website</h3>
                <a href={agent.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-900">
                  {agent.website}
                </a>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Created At</h3>
              <p className="text-gray-900">{new Date(agent.created_at).toLocaleString('en-GB')}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Updated At</h3>
              <p className="text-gray-900">{new Date(agent.updated_at).toLocaleString('en-GB')}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Edit
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
