import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PdfUploader } from './components/PdfUploader';
import { ComputationSheet } from './components/ComputationSheet';
import { ClientDirectory } from './components/ClientDirectory';
import { ComputationEditor } from './components/ComputationEditor';
import { FirmSettingsModal } from './components/FirmSettingsModal';
import { RegimeComparisonModal } from './components/RegimeComparisonModal';
import { WhatsAppShareModal } from './components/WhatsAppShareModal';
import { AiDocumentScannerModal } from './components/AiDocumentScannerModal';
import { IncomeTaxPortalSyncModal } from './components/IncomeTaxPortalSyncModal';
import { ManualClientModal } from './components/ManualClientModal';
import { ChallanRegister } from './components/ChallanRegister';
import { TaxComputation, FirmDetails, Language, TaxRegime, TaxChallanRecord } from './types';
import { 
  loadSavedComputations, 
  saveComputations, 
  loadStandaloneChallans,
  saveStandaloneChallans,
  loadFirmDetails, 
  saveFirmDetails, 
  loadLanguage, 
  saveLanguage 
} from './utils/storage';
import { exportClientListToExcel } from './utils/excelExporter';

export function App() {
  const [lang, setLang] = useState<Language>(loadLanguage());
  const [firm, setFirm] = useState<FirmDetails>(loadFirmDetails());
  const [computations, setComputations] = useState<TaxComputation[]>(loadSavedComputations());
  const [standaloneChallans, setStandaloneChallans] = useState<TaxChallanRecord[]>(loadStandaloneChallans());
  
  // Navigation & Active Computation
  const [currentTab, setCurrentTab] = useState<'upload' | 'sheet' | 'clients' | 'challans'>('sheet');
  const [activeComputation, setActiveComputation] = useState<TaxComputation>(
    computations[0] || loadSavedComputations()[0]
  );

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFirmModalOpen, setIsFirmModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [isAiScannerModalOpen, setIsAiScannerModalOpen] = useState(false);
  const [isPortalSyncModalOpen, setIsPortalSyncModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Save changes to storage
  useEffect(() => {
    saveComputations(computations);
  }, [computations]);

  useEffect(() => {
    saveStandaloneChallans(standaloneChallans);
  }, [standaloneChallans]);

  useEffect(() => {
    saveFirmDetails(firm);
  }, [firm]);

  useEffect(() => {
    saveLanguage(lang);
  }, [lang]);

  // When a new PDF or computation is extracted/loaded
  const handleComputationLoaded = (newComp: TaxComputation) => {
    // Add to list or replace if matching PAN & AY
    const existingIndex = computations.findIndex(
      (c) => c.client.pan === newComp.client.pan && c.assessmentYear === newComp.assessmentYear
    );

    let updatedList: TaxComputation[];
    if (existingIndex >= 0) {
      updatedList = [...computations];
      updatedList[existingIndex] = newComp;
    } else {
      updatedList = [newComp, ...computations];
    }

    setComputations(updatedList);
    setActiveComputation(newComp);
    setCurrentTab('sheet');
  };

  // Update any computation (syncs activeComputation if matching id)
  const handleUpdateComputation = (updated: TaxComputation) => {
    if (activeComputation?.id === updated.id) {
      setActiveComputation(updated);
    }
    setComputations(prev => 
      prev.map(c => c.id === updated.id ? updated : c)
    );
  };

  // Delete computation
  const handleDeleteComputation = (id: string) => {
    const remaining = computations.filter(c => c.id !== id);
    setComputations(remaining);
    if (activeComputation?.id === id && remaining.length > 0) {
      setActiveComputation(remaining[0]);
    }
  };

  // Select computation from directory
  const handleSelectFromDirectory = (comp: TaxComputation) => {
    setActiveComputation(comp);
    setCurrentTab('sheet');
  };

  // Edit computation/client directly from directory
  const handleEditFromDirectory = (comp: TaxComputation) => {
    setActiveComputation(comp);
    setIsEditModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      
      {/* Top Navigation & Brand Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        lang={lang}
        setLang={setLang}
        firm={firm}
        onOpenFirmModal={() => setIsFirmModalOpen(true)}
        onOpenAiScannerModal={() => setIsAiScannerModalOpen(true)}
        onOpenPortalSyncModal={() => setIsPortalSyncModalOpen(true)}
        onOpenManualClientModal={() => setIsManualModalOpen(true)}
        computations={computations}
        totalChallansCount={
          computations.reduce((sum, c) => sum + (c.taxesPaid?.challans?.length || 0), 0) +
          standaloneChallans.length
        }
        onExportAllExcel={() => exportClientListToExcel(computations)}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 pb-12">
        {currentTab === 'upload' && (
          <PdfUploader
            lang={lang}
            onComputationLoaded={handleComputationLoaded}
            onOpenAiScannerModal={() => setIsAiScannerModalOpen(true)}
            onOpenPortalSyncModal={() => setIsPortalSyncModalOpen(true)}
            onOpenManualClientModal={() => setIsManualModalOpen(true)}
          />
        )}

        {currentTab === 'sheet' && activeComputation && (
          <ComputationSheet
            computation={activeComputation}
            firm={firm}
            lang={lang}
            onUpdateComputation={handleUpdateComputation}
            onOpenEditModal={() => setIsEditModalOpen(true)}
            onOpenCompareModal={() => setIsCompareModalOpen(true)}
            onOpenWhatsAppModal={() => setIsWhatsAppModalOpen(true)}
            onOpenAiScannerModal={() => setIsAiScannerModalOpen(true)}
            onOpenPortalSyncModal={() => setIsPortalSyncModalOpen(true)}
            onBackToUpload={() => setCurrentTab('upload')}
          />
        )}

        {currentTab === 'clients' && (
          <ClientDirectory
            computations={computations}
            lang={lang}
            onSelectComputation={handleSelectFromDirectory}
            onEditComputation={handleEditFromDirectory}
            onDeleteComputation={handleDeleteComputation}
            onAddNew={() => setCurrentTab('upload')}
            onOpenManualClientModal={() => setIsManualModalOpen(true)}
          />
        )}

        {currentTab === 'challans' && (
          <ChallanRegister
            computations={computations}
            standaloneChallans={standaloneChallans}
            firm={firm}
            onUpdateComputation={handleUpdateComputation}
            onUpdateStandaloneChallans={setStandaloneChallans}
            onSelectComputation={handleSelectFromDirectory}
          />
        )}
      </main>

      {/* MODALS */}
      {isManualModalOpen && (
        <ManualClientModal
          isOpen={isManualModalOpen}
          onClose={() => setIsManualModalOpen(false)}
          onClientAdded={handleComputationLoaded}
          lang={lang}
        />
      )}
      {isEditModalOpen && activeComputation && (
        <ComputationEditor
          computation={activeComputation}
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleUpdateComputation}
        />
      )}

      {isFirmModalOpen && (
        <FirmSettingsModal
          firm={firm}
          isOpen={isFirmModalOpen}
          onClose={() => setIsFirmModalOpen(false)}
          onSave={setFirm}
        />
      )}

      {isCompareModalOpen && activeComputation && (
        <RegimeComparisonModal
          computation={activeComputation}
          isOpen={isCompareModalOpen}
          onClose={() => setIsCompareModalOpen(false)}
          onSelectRegime={(regime: TaxRegime) => {
            handleUpdateComputation({
              ...activeComputation,
              regimeOpted: regime,
            });
          }}
        />
      )}

      {isWhatsAppModalOpen && activeComputation && (
        <WhatsAppShareModal
          computation={activeComputation}
          firm={firm}
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
        />
      )}

      {isAiScannerModalOpen && activeComputation && (
        <AiDocumentScannerModal
          computation={activeComputation}
          isOpen={isAiScannerModalOpen}
          onClose={() => setIsAiScannerModalOpen(false)}
          onUpdateComputation={handleUpdateComputation}
        />
      )}

      {isPortalSyncModalOpen && activeComputation && (
        <IncomeTaxPortalSyncModal
          computation={activeComputation}
          isOpen={isPortalSyncModalOpen}
          onClose={() => setIsPortalSyncModalOpen(false)}
          onUpdateComputation={handleUpdateComputation}
        />
      )}

    </div>
  );
}

export default App;
