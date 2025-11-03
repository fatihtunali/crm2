interface Provider {
  id: number;
  organization_id: number;
  provider_name: string;
  provider_type: string;
  city: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ViewProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  provider: Provider | null;
}

export default function ViewProviderModal({ isOpen, onClose, onEdit, provider }: ViewProviderModalProps) {
  if (!isOpen || !provider) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'archived': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const formatProviderTypeName = (type: string) => {
    const names: { [key: string]: string } = {
      'hotel': 'Hotel',
      'tour_operator': 'Tour Operator',
      'transport': 'Transport',
      'restaurant': 'Restaurant',
      'government': 'Government',
      'guide': 'Guide',
      'entrance_fee': 'Entrance Fee',
      'other': 'Other'
    };
    return names[type] || type;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">Supplier Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="col-span-2">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Provider ID</h3>
              <p className="text-gray-900 font-mono text-lg">#{provider.id}</p>
            </div>
            <div className="col-span-2">
              <h3 className="text-sm font-medium text-gray-500 mb-1">Provider Name</h3>
              <p className="text-gray-900 font-semibold text-xl">{provider.provider_name}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Provider Type</h3>
              <p className="text-gray-900 text-lg">{formatProviderTypeName(provider.provider_type)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
              <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(provider.status)}`}>
                {provider.status}
              </span>
            </div>
            {provider.city && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">City</h3>
                <p className="text-gray-900">{provider.city}</p>
              </div>
            )}
          </div>

          {/* Contact Information */}
          {(provider.address || provider.contact_phone || provider.contact_email) && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Contact Information</h3>
              <div className="grid grid-cols-2 gap-4">
                {provider.address && (
                  <div className="col-span-2">
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Address</h4>
                    <p className="text-gray-900">{provider.address}</p>
                  </div>
                )}
                {provider.contact_phone && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Phone</h4>
                    <p className="text-gray-900 flex items-center gap-2">
                      <span>📞</span>
                      {provider.contact_phone}
                    </p>
                  </div>
                )}
                {provider.contact_email && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-1">Email</h4>
                    <a
                      href={`mailto:${provider.contact_email}`}
                      className="text-primary-600 hover:underline flex items-center gap-2"
                    >
                      <span>✉️</span>
                      {provider.contact_email}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {provider.notes && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-gray-900 whitespace-pre-wrap">{provider.notes}</p>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="mb-6 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Metadata</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Created At</h4>
                <p className="text-gray-900 text-sm">{formatDate(provider.created_at)}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Last Updated</h4>
                <p className="text-gray-900 text-sm">{formatDate(provider.updated_at)}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Organization ID</h4>
                <p className="text-gray-900 text-sm font-mono">#{provider.organization_id}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={() => { onClose(); onEdit(); }}
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
