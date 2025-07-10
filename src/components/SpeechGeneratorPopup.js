import React, { useState, useEffect, useCallback } from 'react';
import moment from 'moment';
import 'moment/locale/ro'; 
import './SpeechGeneratorPopup.css'; 

// Lista IFN-uri primita de la user
const refinantareOptions = [
  "AmanetCredit", "AmanetQuick", "BestCredit", "BTDirect", "BRDFinance", "Credex", 
  "Credius", "Credissimo", "CreditAmanet", "CreditFix", "CreditPrime", "ExtraFinance", 
  "Ferratum", "Hora", "iCredit", "IdeaLeasing", "INGLease", "InstantCredit", 
  "JoyCredit", "Mobilo", "Mozipo", "Mogo", "OceanCredit", "Oney", "OTPLeasing", 
  "PatriaCredit", "Provident", "SimpluCredit", "TBI", "Telecredit", 
  "UnicreditConsumer", "Viva", "Volt", "Zaplo"
];

function SpeechGeneratorPopup({ appointmentData, onClose, isOpen }) {
  const [pensionarSelected, setPensionarSelected] = useState(false);
  const [contracteSelected, setContracteSelected] = useState(false);
  const [singularContractSelected, setSingularContractSelected] = useState(false);
  const [currentRefinantareSelection, setCurrentRefinantareSelection] = useState('');
  const [selectedRefinantari, setSelectedRefinantari] = useState([]);
  const [copyButtonText, setCopyButtonText] = useState('Copiază');
  const [plainTextForCopy, setPlainTextForCopy] = useState('');

  const handleAddRefinantare = () => {
    if (currentRefinantareSelection && !selectedRefinantari.includes(currentRefinantareSelection)) {
      setSelectedRefinantari([...selectedRefinantari, currentRefinantareSelection]);
      setCurrentRefinantareSelection('');
    }
  };

  const handleRemoveRefinantare = (addressToRemove) => {
    setSelectedRefinantari(selectedRefinantari.filter(addr => addr !== addressToRemove));
  };

  // Functie redenumita - genereaza doar text simplu cu formatare WhatsApp
  const generateSpeechText = useCallback(() => {
    if (!appointmentData) return ''; // Return empty string

    // --- Date Calculation --- 
    let dateObject = appointmentData.date;
    if (dateObject && typeof dateObject.toDate === 'function') { 
      dateObject = dateObject.toDate();
    }
    const { time } = appointmentData;
    const appointmentMoment = moment(dateObject);
    appointmentMoment.locale('ro'); 
    if (!appointmentMoment.isValid()) {
      console.error("Invalid date passed:", appointmentData.date);
      return "Eroare: Data invalidă."; 
    }
    const zi = appointmentMoment.format('dddd').charAt(0).toUpperCase() + appointmentMoment.format('dddd').slice(1);
    const dataFormatata = appointmentMoment.format('DD MMMM YYYY'); 
    const ora = time;
    const adresaBirou = "Bulevardul Iuliu Maniu, nr. 7";

    // --- Acte Necesare (same logic) --- 
    let acteNecesare = [];
    if (pensionarSelected) {
      acteNecesare.push("Decizia de pensionare (în original)"); 
      acteNecesare.push("Ultimul cupon de pensie");
    }
    if (contracteSelected) {
        acteNecesare.push(singularContractSelected 
            ? "Contractul de credit (în format fizic sau electronic)" 
            : "Contractele tuturor creditelor (în format fizic sau electronic)");
    }
    if (selectedRefinantari.length > 0) {
        selectedRefinantari.forEach(addr => acteNecesare.push(`Adresa de refinanțare ${addr}`));
    }
    acteNecesare.push("Buletinul");
    
    // --- Generate Plain Text for Copying (with asterisks) --- 
    const acteTextPlain = acteNecesare.join('\n');
    // Add asterisks for WhatsApp bold formatting
    const plainText = `Bună ziua!\nConform discuției telefonice, rămâne stabilită întâlnirea de *${zi}, ${dataFormatata}*, ora *${ora}*. Biroul nostru se află pe *${adresaBirou}*. Vă rog să mă sunați când ajungeți pentru a vă prelua.\nPentru refinanțare, vă rog să aveți la dumneavoastră următoarele documente:\n${acteTextPlain}\n\nVă aștept la întâlnire. Zi frumoasă!`;

    return plainText; // Return only plain text

  }, [appointmentData, pensionarSelected, contracteSelected, singularContractSelected, selectedRefinantari]);

  // Update plain text state when dependencies change (initial generation)
  useEffect(() => {
    setPlainTextForCopy(generateSpeechText());
  }, [generateSpeechText]); 

  // Handler for manual text changes
  const handleTextChange = (event) => {
      setPlainTextForCopy(event.target.value);
  };

  // Copy uses the plain text state
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainTextForCopy); 
      setCopyButtonText('Copiat!');
      setTimeout(() => setCopyButtonText('Copiază'), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setCopyButtonText('Eroare');
      setTimeout(() => setCopyButtonText('Copiază'), 2000);
    }
  };
  
  // Oprim propagarea click-ului din interiorul popup-ului
  const handlePopupContentClick = (e) => {
    e.stopPropagation();
  };

  if (!appointmentData) return null;

  return (
    <div className={`popup-overlay-speech ${isOpen ? 'visible' : ''}`} onClick={onClose}>
      <div className="popup-content-speech" onClick={handlePopupContentClick}>
        <h2>Generator Mesaj Client</h2>
        <textarea 
          className="speech-display-area"
          value={plainTextForCopy} 
          onChange={handleTextChange} 
          rows="12"
        />
        
        <div className="popup-controls">
          <button 
            className={`speech-toggle-button ${pensionarSelected ? 'active' : ''}`}
            onClick={() => setPensionarSelected(!pensionarSelected)}
          >
            Pensionar
          </button>
          <div className="contract-control">
            <button 
              className={`speech-toggle-button ${contracteSelected ? 'active' : ''}`}
              onClick={() => setContracteSelected(!contracteSelected)}
            >
              Contracte credite
            </button>
            {contracteSelected && (
              <div 
                className={`speech-checkbox ${singularContractSelected ? 'checked' : ''}`}
                onClick={() => setSingularContractSelected(!singularContractSelected)}
                title="Bifează pentru un singur contract"
              >
                {singularContractSelected ? '✓' : ''}
              </div>
            )}
          </div>
          <div className="refinantare-control">
            <select 
               value={currentRefinantareSelection} 
               onChange={(e) => setCurrentRefinantareSelection(e.target.value)}
               className="speech-select"
            >
              <option value="">-- Selectează Adresă --</option>
              {refinantareOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <button 
              onClick={handleAddRefinantare}
              className="speech-add-button"
              title="Adaugă adresa selectată"
              disabled={!currentRefinantareSelection}
            >
              +
            </button>
          </div>
          {selectedRefinantari.length > 0 && (
            <div className="selected-refinantari-list">
              {selectedRefinantari.map(addr => (
                <span key={addr} className="refinantare-tag">
                  {addr}
                  <button onClick={() => handleRemoveRefinantare(addr)} title="Șterge">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="popup-actions">
            <button onClick={handleCopy} className="speech-action-button copy-button">
                {copyButtonText}
            </button>
            <button onClick={onClose} className="speech-action-button close-button">
                Închide
            </button>
        </div>
      </div>
    </div>
  );
}

export default SpeechGeneratorPopup; 