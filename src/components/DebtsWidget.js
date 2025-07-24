import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTeamBuilding } from './TeamBuildingContext';
import { useDebts } from '../context/DebtsContext';
import './DebtsWidget.css';

// Define the list of agents specifically for DebtsWidget
const DEBTS_WIDGET_AGENTS = [
  'Claudiu', 'Voicu', 'Cosmina', 'Cristina', 'Andreea', 'George', 'Florin', 
  'Mihaela', 'Scarlat', 'Catalina', 'Andrei', 'Niki', 
  'Valentina P', 'Alin M', 'Luca', 'Larisa'
];

const DebtsWidget = () => {
  const { currentUser } = useAuth();
  const { addToTeamBuilding } = useTeamBuilding();
  const { debts, addDebt, processPayment, cleanOldHistory } = useDebts();
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', type: 'success' });
  const [showAll, setShowAll] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);

  const canAddDebts = currentUser?.name === 'Claudiu' || currentUser?.name === 'Dida';
  const canApprovePayment = currentUser?.name === 'Claudiu';

  useEffect(() => {
    cleanOldHistory();
    // eslint-disable-next-line
  }, []);

  // Effect to auto-hide snackbar
  useEffect(() => {
    if (snackbar.open) {
      const timer = setTimeout(() => {
        setSnackbar(prev => ({ ...prev, open: false }));
      }, 2500); // Duration of the fadeInOut animation
      return () => clearTimeout(timer); // Cleanup timer if component unmounts or snackbar changes
    }
  }, [snackbar]);

  const handleAddDebt = (agentName, amount) => {
    addDebt(agentName, amount, currentUser.name);
    setSnackbar({
      open: true,
      message: `Datorie adăugată pentru ${agentName}: ${amount} RON`,
      type: 'success'
    });
  };

  const handlePayment = () => {
    if (!selectedAgent || !paymentAmount) return;
    const amount = Number(paymentAmount);
    if (amount <= 0 || amount > debts[selectedAgent]) {
      setSnackbar({
        open: true,
        message: 'Sumă invalidă!',
        type: 'error'
      });
      return;
    }
    processPayment(selectedAgent, amount, currentUser.name);
    addToTeamBuilding(selectedAgent, amount);
    setSnackbar({
      open: true,
      message: `Plată procesată pentru ${selectedAgent}: ${amount} RON`,
      type: 'success'
    });
    setOpenDialog(false);
    setPaymentAmount('');
  };

  const totalDebts = useMemo(() => {
    // Ensure we only sum numeric values from the debts object
    return Object.values(debts).reduce((sum, amount) => {
      const numericAmount = Number(amount);
      return sum + (isNaN(numericAmount) ? 0 : numericAmount);
    }, 0);
  }, [debts]); // Recalculate only when debts object changes

  // Sort agents by debt amount in descending order
  const sortedDebtsAgents = [...DEBTS_WIDGET_AGENTS].sort((agentA, agentB) => {
    const debtA = debts[agentA] || 0;
    const debtB = debts[agentB] || 0;
    return debtB - debtA; // Sort descending
  });

  const visibleAgents = showAll ? sortedDebtsAgents : sortedDebtsAgents.slice(0, 5);

  return (
    <div className="debts-widget-list">
      <h2>Datorii</h2>
      <ul className="debts-list">
        {visibleAgents.map(agent => (
          <li
            className={`debt-list-item${selectedRow === agent ? ' selected' : ''}`}
            key={agent}
            onClick={() => setSelectedRow(selectedRow === agent ? null : agent)}
            style={{ cursor: 'pointer' }}
          >
            <span className="debt-agent">{agent}</span>
            <span className="debt-amount">{debts[agent] || 0} RON</span>
            {selectedRow === agent && canAddDebts && (
              <span className="debt-buttons">
                <button onClick={e => { e.stopPropagation(); handleAddDebt(agent, 25); }}>+25</button>
                <button onClick={e => { e.stopPropagation(); handleAddDebt(agent, 100); }}>+100</button>
                <button onClick={e => { e.stopPropagation(); handleAddDebt(agent, 200); }}>+200</button>
              </span>
            )}
            {selectedRow === agent && canApprovePayment && debts[agent] > 0 && (
              <button
                className="debt-pay"
                onClick={e => {
                  e.stopPropagation();
                  setSelectedAgent(agent);
                  setOpenDialog(true);
                }}
              >
                Achitare
              </button>
            )}
          </li>
        ))}
      </ul>
      {DEBTS_WIDGET_AGENTS.length > 5 && (
        <button className="debts-show-more" onClick={() => setShowAll(s => !s)}>
          {showAll ? 'Arată mai puțini' : 'Arată mai mulți'}
        </button>
      )}
      <div className="debts-total">Total: {totalDebts} RON</div>

      {/* Dialog pentru achitare */}
      {openDialog && (
        <div className="debt-dialog-backdrop">
          <div className="debt-dialog">
            <h3>Achitare datorie - {selectedAgent}</h3>
            <input
              type="number"
              placeholder="Suma achitată"
              value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value)}
              min="1"
              max={debts[selectedAgent]}
            />
            <div className="debt-dialog-buttons">
              <button onClick={() => setOpenDialog(false)}>Anulează</button>
              <button onClick={handlePayment}>Confirmă</button>
            </div>
          </div>
        </div>
      )}

      {/* Snackbar pentru notificări */}
      {snackbar.open && (
        <div className={`debt-snackbar ${snackbar.type}`}>
          {snackbar.message}
        </div>
      )}
    </div>
  );
};

export default DebtsWidget; 