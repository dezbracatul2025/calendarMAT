import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTeamBuilding } from './TeamBuildingContext';
import './TeamBuildingWidget.css';

// PARTICIPANTS list is now primarily managed/sourced via TeamBuildingContext's KNOWN_PARTICIPANTS
// However, TeamBuildingWidget might still need its own copy for rendering if context doesn't expose it directly, or for initial structure.
// For consistency, it's better if the context is the sole source of this list too.
// For now, we'll assume the context handles the list and data, and this component consumes it.
const PARTICIPANTS = [
  'Claudiu', 'Voicu', 'Cosmina', 'Cristina', 'Andreea', 'George', 'Florin', 
  'Mihaela', 'Scarlat', 'Catalina', 'Adriana', 'Andrei', 'Niki', 
  'Valentina P', 'Alin M'
]; // This is still used by DebtsWidget, ensure it's consistent or refactor DebtsWidget too.

const COLLECTION_NAME = 'teambuilding_contributions';
const MAX_BAR_HEIGHT_PERCENT = 80; // Max height for podium bars as percentage of container
const PODIUM_PLACES = ['1st', '2nd', '3rd']; // For display

function TeamBuildingWidget() {
  const { currentUser } = useAuth();
  const { 
    contributions,
    isLoading: isLoadingContext, 
    error: errorContext 
  } = useTeamBuilding();

  const [sortedContributions, setSortedContributions] = useState([]);
  const [top3, setTop3] = useState([]);
  const [maxAmount, setMaxAmount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  // const [selectedAgentForAdd, setSelectedAgentForAdd] = useState(null); // Removed

  // Effect to calculate sorted list, top 3, and max amount when contributions (from context) change
  useEffect(() => {
    if (Object.keys(contributions).length === 0 && !isLoadingContext) return;
    if (isLoadingContext) return; // Don't process if context is still loading

    const participantNames = Object.keys(contributions);

    const sorted = participantNames
      .map(name => ({ name, amount: contributions[name] || 0 }))
      .sort((a, b) => b.amount - a.amount); // Sort descending

    setSortedContributions(sorted);
    setTop3(sorted.slice(0, 3));

    const currentMax = sorted.length > 0 ? Math.max(...sorted.map(c => c.amount)) : 0;
    setMaxAmount(currentMax > 0 ? currentMax : 1);

  }, [contributions, isLoadingContext]);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    // setSelectedAgentForAdd(null); // Removed
  };

  /* // Removed handleAgentSelect
  const handleAgentSelect = (agentName) => {
    if (!canManageContributions) return;
    setSelectedAgentForAdd(prev => (prev === agentName ? null : agentName));
  };
  */

  /* // Removed handleAddContribution as buttons are removed. If direct add via other means is needed, this can be adapted.
  const handleAddContribution = async (agentName, incrementValue) => {
    if (!canManageContributions || !agentName) return;
    await addToTeamBuilding(agentName, incrementValue);
  };
  */

  // Calculate total contributions
  const totalContributions = useMemo(() => {
    return Object.values(contributions).reduce((sum, amount) => {
      const numericAmount = Number(amount);
      return sum + (isNaN(numericAmount) ? 0 : numericAmount);
    }, 0);
  }, [contributions]);

  const renderPodium = () => {
    if (top3.length === 0 && !isLoadingContext) {
      return <div className="podium-view empty">Încă nu există contribuții.</div>;
    }
    const podiumData = PODIUM_PLACES.map((place, index) => {
        return top3[index] || { name: `Locul ${index + 1}`, amount: 0 };
    });
    while(podiumData.length < 3) {
        podiumData.push({ name: `Locul ${podiumData.length + 1}`, amount: 0 });
    }
    const displayOrder = [ podiumData[1], podiumData[0], podiumData[2] ];
    return (
      <div className="podium-view">
        {displayOrder.map((agent, index) => {
          const barHeightPercent = maxAmount > 0 
             ? Math.min((agent.amount / maxAmount) * 100, MAX_BAR_HEIGHT_PERCENT) 
             : 0;
          const originalIndex = top3.findIndex(p => p.name === agent.name);
          let placeNumber = originalIndex !== -1 ? originalIndex + 1 : null;
          if (agent.amount === 0) placeNumber = null;
          let rankClass = '';
          if (placeNumber === 1) rankClass = 'rank-1';
          else if (placeNumber === 2) rankClass = 'rank-2';
          else if (placeNumber === 3) rankClass = 'rank-3';
          return (
            <div key={agent.name + "-" + index} className={`podium-bar-container ${rankClass}`}> 
              <div className="podium-position">{placeNumber}</div>
              <div className="podium-bar" style={{ height: `${barHeightPercent}%` }}>
                  {agent.amount >= 0 && (
                      <div className="podium-bar-label">
                        {agent.name}
                        <span>{agent.amount}</span>
                      </div>
                  )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderList = () => {
    if (sortedContributions.length === 0 && !isLoadingContext) {
        return <div className="list-view empty">Nu există contribuții de afișat.</div>;
    }
    return (
      <div className="list-view">
         {sortedContributions.map(agent => (
           <div className={`list-item-wrapper`} key={agent.name}>
             <div 
               className={`list-item`}
             >
               <span>{agent.name}</span>
               <span>{agent.amount}</span> {/* Corrected: was agent.name, changed back to agent.amount */}
             </div>
             {/* Removed button rendering block */}
           </div>
         ))}
      </div>
    );
  };

  if (isLoadingContext) {
    return <div className="widget-container team-building-widget loading">Se încarcă #TeamBuilding...</div>;
  }

  return (
    <div className={`widget-container team-building-widget ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <h3>#TeamBuilding</h3>
      {errorContext && <div className="error-message">{errorContext}</div>}
      
      <div className="widget-content">
          {isExpanded ? renderList() : renderPodium()}
      </div>

      {/* Display Total Contributions */}
      {!isLoadingContext && Object.keys(contributions).length > 0 && (
        <div className="teambuilding-total">
          Total: {totalContributions} RON
        </div>
      )}

      <button onClick={toggleExpand} className="toggle-button">
        {isExpanded ? 'Arata mai putin' : 'Arata mai mult'}
      </button>
    </div>
  );
}

export default TeamBuildingWidget;
// Ensure PARTICIPANTS is defined if it was intended to be used locally or passed as prop
// If it needs to be shared, context or a shared utility file is better.
// export { PARTICIPANTS }; // This line (or similar) should be removed or handled differently 