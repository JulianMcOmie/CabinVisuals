'use client';

import React, { useState } from 'react';
import { createClient } from '../../src/utils/supabase/client';
import * as supabaseService from '../../src/Persistence/supabase-service';

export default function TestSupabasePage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [workflowState, setWorkflowState] = useState<{
    isRunning: boolean;
    currentStep: number;
    totalSteps: number;
    createdProjectId: string | null;
    createdTrackId: string | null;
    createdBlockId: string | null;
    createdNoteIds: string[];
  }>({
    isRunning: false,
    currentStep: 0,
    totalSteps: 12,
    createdProjectId: null,
    createdTrackId: null,
    createdBlockId: null,
    createdNoteIds: []
  });

  // Make functions available globally for console testing
  React.useEffect(() => {
    (window as any).supabaseService = supabaseService;
    (window as any).createClient = createClient;
    console.log('Supabase service functions available globally as window.supabaseService');
  }, []);

  const addResult = (test: string, result: any, error?: any) => {
    setResults(prev => [...prev, {
      test,
      result,
      error,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const clearResults = () => setResults([]);

  // Test 1: Get current user
  const testGetUser = async () => {
    if (workflowState.isRunning) {
      addResult('Get Current User', 'Cannot run test while step-by-step workflow is running', null);
      return;
    }
    setLoading(true);
    addResult('Get Current User', 'Starting test...', null);
    try {
      addResult('Get Current User', 'Creating Supabase client...', null);
      const supabase = createClient();
      addResult('Get Current User', 'Calling supabase.auth.getUser()...', null);
      
      // Add timeout to prevent hanging
      const authPromise = supabase.auth.getUser();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth call timed out after 5 seconds')), 5000)
      );
      
      const result = await Promise.race([authPromise, timeoutPromise]) as any;
      addResult('Get Current User', 'Auth call completed, processing result...', result);
      
      const { data: { user }, error } = result;
      if (error) {
        addResult('Get Current User', 'Auth error occurred', error);
        return;
      }
      addResult('Get Current User', 'Got user data, processing...', user);
      setUser(user);
      addResult('Get Current User', user ? `User ID: ${user.id}` : 'No user logged in');
    } catch (error) {
      addResult('Get Current User', 'Error occurred', error);
    } finally {
      addResult('Get Current User', 'Finally block reached, setting loading to false', null);
      setLoading(false);
    }
  };

  // Test 2: Get project list
  const testGetProjectList = async () => {
    setLoading(true);
    try {
      const projects = await supabaseService.getSupabaseProjectList();
      addResult('Get Project List', `Found ${projects.length} projects`);
    } catch (error) {
      addResult('Get Project List', null, error);
    } finally {
      setLoading(false);
    }
  };

  // Test 3: Create a test project
  const testCreateProject = async () => {
    setLoading(true);
    try {
      const projectId = await supabaseService.createSupabaseProject(`Test Project ${Date.now()}`);
      addResult('Create Project', projectId ? `Created project: ${projectId}` : 'Failed to create project');
    } catch (error) {
      addResult('Create Project', null, error);
    } finally {
      setLoading(false);
    }
  };

  // Test 4: Load full project (if any exist)
  const testLoadFullProject = async () => {
    setLoading(true);
    try {
      const projects = await supabaseService.getSupabaseProjectList();
      if (projects.length > 0) {
        const projectState = await supabaseService.loadFullProjectFromSupabase(projects[0].id);
        addResult('Load Full Project', projectState ? 'Project loaded successfully' : 'Failed to load project');
      } else {
        addResult('Load Full Project', 'No projects to load', null);
      }
    } catch (error) {
      addResult('Load Full Project', null, error);
    } finally {
      setLoading(false);
    }
  };

  // Test 5: Save project settings
  const testSaveProjectSettings = async () => {
    setLoading(true);
    try {
      const projects = await supabaseService.getSupabaseProjectList();
      if (projects.length > 0) {
        const testSettings = {
          projectId: projects[0].id,
          bpm: 140,
          isPlaying: false,
          loopEnabled: true,
          loopStartBeat: 0,
          loopEndBeat: 16,
          numMeasures: 32,
          isInstrumentSidebarVisible: true,
          selectedWindow: 'piano-roll'
        };
        const success = await supabaseService.saveProjectSettings(testSettings);
        addResult('Save Project Settings', success ? 'Settings saved successfully' : 'Failed to save settings');
      } else {
        addResult('Save Project Settings', 'No projects to save settings for', null);
      }
    } catch (error) {
      addResult('Save Project Settings', null, error);
    } finally {
      setLoading(false);
    }
  };

  // Test 6: Create and save a track
  const testSaveTrack = async () => {
    setLoading(true);
    try {
      const projects = await supabaseService.getSupabaseProjectList();
      if (projects.length > 0) {
        const testTrack = {
          id: crypto.randomUUID(),
          projectId: projects[0].id,
          name: `Test Track ${Date.now()}`,
          order: 1,
          isMuted: false,
          isSoloed: false
        };
        const success = await supabaseService.saveTrack(testTrack);
        addResult('Save Track', success ? 'Track saved successfully' : 'Failed to save track');
      } else {
        addResult('Save Track', 'No projects to save track for', null);
      }
    } catch (error) {
      addResult('Save Track', null, error);
    } finally {
      setLoading(false);
    }
  };

  // Test 7: Delete a project
  const testDeleteProject = async () => {
    setLoading(true);
    try {
      const projects = await supabaseService.getSupabaseProjectList();
      if (projects.length > 0) {
        const projectToDelete = projects[projects.length - 1]; // Delete the last project
        const success = await supabaseService.deleteSupabaseProject(projectToDelete.id);
        addResult('Delete Project', success ? `Deleted project: ${projectToDelete.name}` : 'Failed to delete project');
      } else {
        addResult('Delete Project', 'No projects to delete', null);
      }
    } catch (error) {
      addResult('Delete Project', null, error);
    } finally {
      setLoading(false);
    }
  };

  // Test 8: Save MIDI Block
  const testSaveMidiBlock = async () => {
    setLoading(true);
    try {
      const projects = await supabaseService.getSupabaseProjectList();
      if (projects.length > 0) {
        const projectId = projects[0].id;
        const testBlock = {
          id: crypto.randomUUID(),
          trackId: crypto.randomUUID(), // We'll need a real track ID for this to work
          startBeat: 0,
          endBeat: 4
        };
        const success = await supabaseService.saveMidiBlock(testBlock);
        addResult('Save MIDI Block', success ? 'MIDI block saved successfully' : 'Failed to save MIDI block');
      } else {
        addResult('Save MIDI Block', 'No projects to save MIDI block for', null);
      }
    } catch (error) {
      addResult('Save MIDI Block', null, error);
    } finally {
      setLoading(false);
    }
  };

  // Test 9: Save MIDI Notes Batch
  const testSaveMidiNotesBatch = async () => {
    setLoading(true);
    try {
      const testNotes = [
        {
          id: crypto.randomUUID(),
          startBeat: 0,
          duration: 1,
          velocity: 100,
          pitch: 60
        },
        {
          id: crypto.randomUUID(),
          startBeat: 1,
          duration: 1,
          velocity: 80,
          pitch: 64
        },
        {
          id: crypto.randomUUID(),
          startBeat: 2,
          duration: 2,
          velocity: 90,
          pitch: 67
        }
      ];
      const blockId = crypto.randomUUID(); // We'll need a real block ID for this to work
      const success = await supabaseService.saveMidiNotesBatch(testNotes, blockId);
      addResult('Save MIDI Notes Batch', success ? `Saved ${testNotes.length} MIDI notes` : 'Failed to save MIDI notes');
    } catch (error) {
      addResult('Save MIDI Notes Batch', null, error);
    } finally {
      setLoading(false);
    }
  };

  // Test 10: Delete MIDI Note
  const testDeleteMidiNote = async () => {
    setLoading(true);
    try {
      const noteId = crypto.randomUUID(); // We'll need a real note ID for this to work
      const success = await supabaseService.deleteMidiNote(noteId);
      addResult('Delete MIDI Note', success ? 'MIDI note deleted successfully' : 'Failed to delete MIDI note');
    } catch (error) {
      addResult('Delete MIDI Note', null, error);
    } finally {
      setLoading(false);
    }
  };

  // Test 11: Delete MIDI Block
  const testDeleteMidiBlock = async () => {
    setLoading(true);
    try {
      const blockId = crypto.randomUUID(); // We'll need a real block ID for this to work
      const success = await supabaseService.deleteMidiBlock(blockId);
      addResult('Delete MIDI Block', success ? 'MIDI block deleted successfully' : 'Failed to delete MIDI block');
    } catch (error) {
      addResult('Delete MIDI Block', null, error);
    } finally {
      setLoading(false);
    }
  };

  // Test 12: Step-by-Step Workflow Test
  const startStepByStepWorkflow = () => {
    setWorkflowState({
      isRunning: true,
      currentStep: 0,
      totalSteps: 12,
      createdProjectId: null,
      createdTrackId: null,
      createdBlockId: null,
      createdNoteIds: []
    });
    addResult('Step-by-Step Workflow', '🚀 Starting step-by-step workflow test. Click "Next Step" to proceed.');
  };

  const executeNextStep = async () => {
    if (!workflowState.isRunning) return;
    
    setLoading(true);
    const currentStep = workflowState.currentStep + 1;
    
    try {
      switch (currentStep) {
        case 1: // Create Project
          addResult('Step-by-Step Workflow', 'Step 1: Creating project...');
          const projectId = await supabaseService.createSupabaseProject(`Step Test Project ${Date.now()}`);
          if (!projectId) {
            addResult('Step-by-Step Workflow', '❌ Failed at Step 1: Project creation', null);
            setWorkflowState(prev => ({ ...prev, isRunning: false }));
            setLoading(false);
            return;
          }
          addResult('Step-by-Step Workflow', `✅ Step 1 Complete: Created project ${projectId}`);
          setWorkflowState(prev => ({ ...prev, currentStep: 1, createdProjectId: projectId }));
          break;

        case 2: // Create Track
          addResult('Step-by-Step Workflow', 'Step 2: Creating track...');
          const trackId = crypto.randomUUID();
          const trackData = {
            id: trackId,
            projectId: workflowState.createdProjectId!,
            name: 'Test Track',
            order: 1,
            isMuted: false,
            isSoloed: false
          };
          const trackSuccess = await supabaseService.saveTrack(trackData);
          if (!trackSuccess) {
            addResult('Step-by-Step Workflow', '❌ Failed at Step 2: Track creation', null);
            setWorkflowState(prev => ({ ...prev, isRunning: false }));
            setLoading(false);
            return;
          }
          addResult('Step-by-Step Workflow', `✅ Step 2 Complete: Created track ${trackId}`);
          setWorkflowState(prev => ({ ...prev, currentStep: 2, createdTrackId: trackId }));
          break;

        case 3: // Create Synth
          addResult('Step-by-Step Workflow', 'Step 3: Creating synth...');
          const synthData = {
            trackId: workflowState.createdTrackId!,
            type: 'oscillator',
            settings: { frequency: 440, waveform: 'sine' }
          };
          const synthSuccess = await supabaseService.saveSynth(synthData);
          if (!synthSuccess) {
            addResult('Step-by-Step Workflow', '❌ Failed at Step 3: Synth creation', null);
            setWorkflowState(prev => ({ ...prev, isRunning: false }));
            setLoading(false);
            return;
          }
          addResult('Step-by-Step Workflow', '✅ Step 3 Complete: Created synth');
          setWorkflowState(prev => ({ ...prev, currentStep: 3 }));
          break;

        case 4: // Create Effect
          addResult('Step-by-Step Workflow', 'Step 4: Creating effect...');
          const effectData = {
            id: crypto.randomUUID(),
            trackId: workflowState.createdTrackId!,
            type: 'reverb',
            settings: { roomSize: 0.5, damping: 0.3 },
            order: 1
          };
          const effectSuccess = await supabaseService.saveEffect(effectData);
          if (!effectSuccess) {
            addResult('Step-by-Step Workflow', '❌ Failed at Step 4: Effect creation', null);
            setWorkflowState(prev => ({ ...prev, isRunning: false }));
            setLoading(false);
            return;
          }
          addResult('Step-by-Step Workflow', '✅ Step 4 Complete: Created effect');
          setWorkflowState(prev => ({ ...prev, currentStep: 4 }));
          break;

        case 5: // Create MIDI Block
          addResult('Step-by-Step Workflow', 'Step 5: Creating MIDI block...');
          const blockId = crypto.randomUUID();
          const blockData = {
            id: blockId,
            trackId: workflowState.createdTrackId!,
            startBeat: 0,
            endBeat: 8
          };
          const blockSuccess = await supabaseService.saveMidiBlock(blockData);
          if (!blockSuccess) {
            addResult('Step-by-Step Workflow', '❌ Failed at Step 5: MIDI block creation', null);
            setWorkflowState(prev => ({ ...prev, isRunning: false }));
            setLoading(false);
            return;
          }
          addResult('Step-by-Step Workflow', `✅ Step 5 Complete: Created MIDI block ${blockId}`);
          setWorkflowState(prev => ({ ...prev, currentStep: 5, createdBlockId: blockId }));
          break;

        case 6: // Create MIDI Notes
          addResult('Step-by-Step Workflow', 'Step 6: Creating MIDI notes...');
          const notesData = [
            {
              id: crypto.randomUUID(),
              startBeat: 0,
              duration: 1,
              velocity: 100,
              pitch: 60
            },
            {
              id: crypto.randomUUID(),
              startBeat: 2,
              duration: 1,
              velocity: 80,
              pitch: 64
            },
            {
              id: crypto.randomUUID(),
              startBeat: 4,
              duration: 2,
              velocity: 90,
              pitch: 67
            }
          ];
          const noteIds = notesData.map(note => note.id);
          const notesSuccess = await supabaseService.saveMidiNotesBatch(notesData, workflowState.createdBlockId!);
          if (!notesSuccess) {
            addResult('Step-by-Step Workflow', '❌ Failed at Step 6: MIDI notes creation', null);
            setWorkflowState(prev => ({ ...prev, isRunning: false }));
            setLoading(false);
            return;
          }
          addResult('Step-by-Step Workflow', `✅ Step 6 Complete: Created ${notesData.length} MIDI notes`);
          setWorkflowState(prev => ({ ...prev, currentStep: 6, createdNoteIds: noteIds }));
          break;

        case 7: // Update Project Settings
          addResult('Step-by-Step Workflow', 'Step 7: Updating project settings...');
          const updatedSettings = {
            projectId: workflowState.createdProjectId!,
            bpm: 140,
            isPlaying: false,
            loopEnabled: true,
            loopStartBeat: 0,
            loopEndBeat: 8,
            numMeasures: 16,
            isInstrumentSidebarVisible: true,
            selectedWindow: 'piano-roll'
          };
          const settingsSuccess = await supabaseService.saveProjectSettings(updatedSettings);
          if (!settingsSuccess) {
            addResult('Step-by-Step Workflow', '❌ Failed at Step 7: Settings update', null);
            setWorkflowState(prev => ({ ...prev, isRunning: false }));
            setLoading(false);
            return;
          }
          addResult('Step-by-Step Workflow', '✅ Step 7 Complete: Updated project settings');
          setWorkflowState(prev => ({ ...prev, currentStep: 7 }));
          break;

        case 8: // Load Full Project
          addResult('Step-by-Step Workflow', 'Step 8: Loading full project to verify...');
          const loadedProject = await supabaseService.loadFullProjectFromSupabase(workflowState.createdProjectId!);
          if (!loadedProject) {
            addResult('Step-by-Step Workflow', '❌ Failed at Step 8: Project loading', null);
            setWorkflowState(prev => ({ ...prev, isRunning: false }));
            setLoading(false);
            return;
          }
          addResult('Step-by-Step Workflow', `✅ Step 8 Complete: Loaded project with ${loadedProject.tracks.length} tracks`);
          setWorkflowState(prev => ({ ...prev, currentStep: 8 }));
          break;

        case 9: // Delete MIDI Notes
          addResult('Step-by-Step Workflow', 'Step 9: Deleting MIDI notes...');
          for (const noteId of workflowState.createdNoteIds) {
            await supabaseService.deleteMidiNote(noteId);
          }
          addResult('Step-by-Step Workflow', `✅ Step 9 Complete: Deleted ${workflowState.createdNoteIds.length} MIDI notes`);
          setWorkflowState(prev => ({ ...prev, currentStep: 9 }));
          break;

        case 10: // Delete MIDI Block
          addResult('Step-by-Step Workflow', 'Step 10: Deleting MIDI block...');
          const blockDeleteSuccess = await supabaseService.deleteMidiBlock(workflowState.createdBlockId!);
          if (!blockDeleteSuccess) {
            addResult('Step-by-Step Workflow', '❌ Failed at Step 10: MIDI block deletion', null);
            setWorkflowState(prev => ({ ...prev, isRunning: false }));
            setLoading(false);
            return;
          }
          addResult('Step-by-Step Workflow', '✅ Step 10 Complete: Deleted MIDI block');
          setWorkflowState(prev => ({ ...prev, currentStep: 10 }));
          break;

        case 11: // Delete Track
          addResult('Step-by-Step Workflow', 'Step 11: Deleting track...');
          const trackDeleteSuccess = await supabaseService.deleteTrack(workflowState.createdTrackId!);
          if (!trackDeleteSuccess) {
            addResult('Step-by-Step Workflow', '❌ Failed at Step 11: Track deletion', null);
            setWorkflowState(prev => ({ ...prev, isRunning: false }));
            setLoading(false);
            return;
          }
          addResult('Step-by-Step Workflow', '✅ Step 11 Complete: Deleted track (synth and effects cascaded)');
          setWorkflowState(prev => ({ ...prev, currentStep: 11 }));
          break;

        case 12: // Delete Project
          addResult('Step-by-Step Workflow', 'Step 12: Deleting project...');
          const projectDeleteSuccess = await supabaseService.deleteSupabaseProject(workflowState.createdProjectId!);
          if (!projectDeleteSuccess) {
            addResult('Step-by-Step Workflow', '❌ Failed at Step 12: Project deletion', null);
            setWorkflowState(prev => ({ ...prev, isRunning: false }));
            setLoading(false);
            return;
          }
          addResult('Step-by-Step Workflow', '✅ Step 12 Complete: Deleted project (settings cascaded)');
          addResult('Step-by-Step Workflow', '🎉 STEP-BY-STEP WORKFLOW TEST PASSED! All 12 steps completed successfully.');
          setWorkflowState(prev => ({ ...prev, isRunning: false, currentStep: 12 }));
          break;

        default:
          addResult('Step-by-Step Workflow', 'All steps completed!');
          setWorkflowState(prev => ({ ...prev, isRunning: false }));
      }
    } catch (error) {
      addResult('Step-by-Step Workflow', `❌ Step ${currentStep} failed with error`, error);
      setWorkflowState(prev => ({ ...prev, isRunning: false }));
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const resetWorkflow = () => {
    setWorkflowState({
      isRunning: false,
      currentStep: 0,
      totalSteps: 12,
      createdProjectId: null,
      createdTrackId: null,
      createdBlockId: null,
      createdNoteIds: []
    });
    setLoading(false); // Ensure loading is cleared when resetting
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Supabase Service Testing</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Current User</h2>
        {user ? (
          <p className="text-green-600">Logged in as: {user.email} (ID: {user.id})</p>
        ) : (
          <p className="text-red-600">Not logged in</p>
        )}
      </div>

      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h3 className="font-semibold mb-2">Debug Info:</h3>
        <p className="text-sm">Loading: {loading.toString()}</p>
        <p className="text-sm">Workflow Running: {workflowState.isRunning.toString()}</p>
        <p className="text-sm">Current Step: {workflowState.currentStep}</p>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Test Functions</h2>
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={testGetUser}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Test Get User
          </button>
          
          <button 
            onClick={testGetProjectList}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            Test Get Project List
          </button>
          
          <button 
            onClick={testCreateProject}
            disabled={loading}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
          >
            Test Create Project
          </button>
          
          <button 
            onClick={testLoadFullProject}
            disabled={loading}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
          >
            Test Load Full Project
          </button>
          
          <button 
            onClick={testSaveProjectSettings}
            disabled={loading}
            className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 disabled:opacity-50"
          >
            Test Save Settings
          </button>
          
          <button 
            onClick={testSaveTrack}
            disabled={loading}
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
          >
            Test Save Track
          </button>
          
          <button 
            onClick={testDeleteProject}
            disabled={loading}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            Test Delete Project
          </button>
          
          <button 
            onClick={testSaveMidiBlock}
            disabled={loading}
            className="px-4 py-2 bg-pink-500 text-white rounded hover:bg-pink-600 disabled:opacity-50"
          >
            Test Save MIDI Block
          </button>
          
          <button 
            onClick={testSaveMidiNotesBatch}
            disabled={loading}
            className="px-4 py-2 bg-rose-500 text-white rounded hover:bg-rose-600 disabled:opacity-50"
          >
            Test Save MIDI Notes
          </button>
          
          <button 
            onClick={testDeleteMidiNote}
            disabled={loading}
            className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
          >
            Test Delete MIDI Note
          </button>
          
          <button 
            onClick={testDeleteMidiBlock}
            disabled={loading}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
          >
            Test Delete MIDI Block
          </button>
          
          <button 
            onClick={startStepByStepWorkflow}
            disabled={loading || workflowState.isRunning}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 font-bold text-lg"
          >
            🚀 Start Step-by-Step Test
          </button>
          
          <button 
            onClick={clearResults}
            disabled={loading}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Clear Results
          </button>
          
          <button 
            onClick={() => {
              setLoading(false);
              setWorkflowState({
                isRunning: false,
                currentStep: 0,
                totalSteps: 12,
                createdProjectId: null,
                createdTrackId: null,
                createdBlockId: null,
                createdNoteIds: []
              });
            }}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            🔧 Force Reset All
          </button>
        </div>
      </div>

      {loading && (
        <div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 rounded">
          <p className="text-yellow-800">Running test... (Loading state: {loading.toString()})</p>
          <button 
            onClick={() => setLoading(false)}
            className="mt-2 px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
          >
            Force Stop Loading
          </button>
        </div>
      )}

      {workflowState.isRunning && (
        <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">Step-by-Step Workflow Progress</h3>
          <div className="mb-4">
            <div className="flex justify-between text-sm text-blue-600 mb-2">
              <span>Step {workflowState.currentStep} of {workflowState.totalSteps}</span>
              <span>{Math.round((workflowState.currentStep / workflowState.totalSteps) * 100)}% Complete</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(workflowState.currentStep / workflowState.totalSteps) * 100}%` }}
              ></div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={executeNextStep}
              disabled={loading || !workflowState.isRunning}
              className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 font-semibold"
            >
              {loading ? 'Running...' : 'Next Step →'}
            </button>
            
            <button 
              onClick={resetWorkflow}
              disabled={loading}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              Reset
            </button>
          </div>
          
          {workflowState.createdProjectId && (
            <div className="mt-4 p-3 bg-white rounded border">
              <p className="text-sm text-gray-600">
                <strong>Created Project ID:</strong> {workflowState.createdProjectId}
              </p>
              {workflowState.createdTrackId && (
                <p className="text-sm text-gray-600">
                  <strong>Created Track ID:</strong> {workflowState.createdTrackId}
                </p>
              )}
              {workflowState.createdBlockId && (
                <p className="text-sm text-gray-600">
                  <strong>Created Block ID:</strong> {workflowState.createdBlockId}
                </p>
              )}
              {workflowState.createdNoteIds.length > 0 && (
                <p className="text-sm text-gray-600">
                  <strong>Created Notes:</strong> {workflowState.createdNoteIds.length} notes
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="text-xl font-semibold mb-4">Test Results</h2>
        {results.length === 0 ? (
          <p className="text-gray-500">No tests run yet. Click a test button above.</p>
        ) : (
          <div className="space-y-4">
            {results.map((result, index) => (
              <div key={index} className="border rounded p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg">{result.test}</h3>
                  <span className="text-sm text-gray-500">{result.timestamp}</span>
                </div>
                
                {result.error ? (
                  <div className="text-red-600">
                    <p className="font-medium">Error:</p>
                    <pre className="text-sm bg-red-50 p-2 rounded mt-1 overflow-auto">
                      {JSON.stringify(result.error, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="text-green-600">
                    <p className="font-medium">Result:</p>
                    <p className="text-sm">{result.result}</p>
                    {result.result && typeof result.result === 'object' && (
                      <pre className="text-sm bg-green-50 p-2 rounded mt-1 overflow-auto">
                        {JSON.stringify(result.result, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
