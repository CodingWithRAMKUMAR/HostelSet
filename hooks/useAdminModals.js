import { useState } from 'react';

export function useAdminModals() {
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedOwner, setSelectedOwner] = useState(null);

  const viewPropertyDetails = (property) => {
    setSelectedProperty(property);
  };

  const viewOwnerDetails = (owner) => {
    setSelectedOwner(owner);
  };

  const closeModals = () => {
    setSelectedProperty(null);
    setSelectedOwner(null);
  };

  return {
    selectedProperty,
    selectedOwner,
    viewPropertyDetails,
    viewOwnerDetails,
    closeModals,
  };
}
