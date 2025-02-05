/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import { SplitView } from '@web/components/splitView';
import * as React from 'react';
import { ActionList } from './actionList';
import { CallTab } from './callTab';
import { ConsoleTab } from './consoleTab';
import type * as modelUtil from './modelUtil';
import type { ActionTraceEventInContext, MultiTraceModel } from './modelUtil';
import { NetworkTab } from './networkTab';
import { SnapshotTab } from './snapshotTab';
import { SourceTab } from './sourceTab';
import { TabbedPane } from '@web/components/tabbedPane';
import type { TabbedPaneTabModel } from '@web/components/tabbedPane';
import { Timeline } from './timeline';
import { MetadataView } from './metadataView';
import { AttachmentsTab } from './attachmentsTab';
import type { Boundaries } from '../geometry';
import { InspectorTab } from './inspectorTab';
import { ToolbarButton } from '@web/components/toolbarButton';

export const Workbench: React.FunctionComponent<{
  model?: MultiTraceModel,
  hideStackFrames?: boolean,
  showSourcesFirst?: boolean,
  rootDir?: string,
  fallbackLocation?: modelUtil.SourceLocation,
  initialSelection?: ActionTraceEventInContext,
  onSelectionChanged?: (action: ActionTraceEventInContext) => void,
  isLive?: boolean,
}> = ({ model, hideStackFrames, showSourcesFirst, rootDir, fallbackLocation, initialSelection, onSelectionChanged, isLive }) => {
  const [selectedAction, setSelectedAction] = React.useState<ActionTraceEventInContext | undefined>(undefined);
  const [highlightedAction, setHighlightedAction] = React.useState<ActionTraceEventInContext | undefined>();
  const [selectedNavigatorTab, setSelectedNavigatorTab] = React.useState<string>('actions');
  const [selectedPropertiesTab, setSelectedPropertiesTab] = React.useState<string>(showSourcesFirst ? 'source' : 'call');
  const [isInspecting, setIsInspecting] = React.useState(false);
  const [highlightedLocator, setHighlightedLocator] = React.useState<string>('');
  const activeAction = model ? highlightedAction || selectedAction : undefined;
  const [selectedTime, setSelectedTime] = React.useState<Boundaries | undefined>();

  const sources = React.useMemo(() => model?.sources || new Map(), [model]);

  React.useEffect(() => {
    setSelectedTime(undefined);
  }, [model]);

  React.useEffect(() => {
    if (selectedAction && model?.actions.includes(selectedAction))
      return;
    const failedAction = model?.actions.find(a => a.error);
    if (initialSelection && model?.actions.includes(initialSelection))
      setSelectedAction(initialSelection);
    else if (failedAction)
      setSelectedAction(failedAction);
    else if (model?.actions.length)
      setSelectedAction(model.actions[model.actions.length - 1]);
  }, [model, selectedAction, setSelectedAction, initialSelection]);

  const onActionSelected = React.useCallback((action: ActionTraceEventInContext) => {
    setSelectedAction(action);
    onSelectionChanged?.(action);
  }, [setSelectedAction, onSelectionChanged]);

  const selectPropertiesTab = React.useCallback((tab: string) => {
    setSelectedPropertiesTab(tab);
    if (tab !== 'inspector')
      setIsInspecting(false);
  }, []);

  const locatorPicked = React.useCallback((locator: string) => {
    setHighlightedLocator(locator);
    selectPropertiesTab('inspector');
  }, [selectPropertiesTab]);

  const sdkLanguage = model?.sdkLanguage || 'javascript';

  const inspectorTab: TabbedPaneTabModel = {
    id: 'inspector',
    title: 'Locator',
    render: () => <InspectorTab
      sdkLanguage={sdkLanguage}
      setIsInspecting={setIsInspecting}
      highlightedLocator={highlightedLocator}
      setHighlightedLocator={setHighlightedLocator} />,
  };
  const callTab: TabbedPaneTabModel = {
    id: 'call',
    title: 'Call',
    render: () => <CallTab action={activeAction} sdkLanguage={sdkLanguage} />
  };
  const sourceTab: TabbedPaneTabModel = {
    id: 'source',
    title: 'Source',
    render: () => <SourceTab
      action={activeAction}
      sources={sources}
      hideStackFrames={hideStackFrames}
      rootDir={rootDir}
      fallbackLocation={fallbackLocation} />
  };
  const consoleTab: TabbedPaneTabModel = {
    id: 'console',
    title: 'Console',
    render: () => <ConsoleTab model={model} boundaries={boundaries} selectedTime={selectedTime} />
  };
  const networkTab: TabbedPaneTabModel = {
    id: 'network',
    title: 'Network',
    render: () => <NetworkTab model={model} selectedTime={selectedTime} />
  };
  const attachmentsTab: TabbedPaneTabModel = {
    id: 'attachments',
    title: 'Attachments',
    render: () => <AttachmentsTab model={model} />
  };

  const tabs: TabbedPaneTabModel[] = showSourcesFirst ? [
    inspectorTab,
    sourceTab,
    consoleTab,
    networkTab,
    callTab,
    attachmentsTab,
  ] : [
    inspectorTab,
    callTab,
    consoleTab,
    networkTab,
    sourceTab,
    attachmentsTab,
  ];

  const { boundaries } = React.useMemo(() => {
    const boundaries = { minimum: model?.startTime || 0, maximum: model?.endTime || 30000 };
    if (boundaries.minimum > boundaries.maximum) {
      boundaries.minimum = 0;
      boundaries.maximum = 30000;
    }
    // Leave some nice free space on the right hand side.
    boundaries.maximum += (boundaries.maximum - boundaries.minimum) / 20;
    return { boundaries };
  }, [model]);

  return <div className='vbox workbench'>
    <Timeline
      model={model}
      boundaries={boundaries}
      onSelected={onActionSelected}
      sdkLanguage={sdkLanguage}
      selectedTime={selectedTime}
      setSelectedTime={setSelectedTime}
    />
    <SplitView sidebarSize={250} orientation='horizontal' sidebarIsFirst={true}>
      <SplitView sidebarSize={250} orientation='vertical'>
        <SnapshotTab
          action={activeAction}
          sdkLanguage={sdkLanguage}
          testIdAttributeName={model?.testIdAttributeName || 'data-testid'}
          isInspecting={isInspecting}
          setIsInspecting={setIsInspecting}
          highlightedLocator={highlightedLocator}
          setHighlightedLocator={locatorPicked} />
        <TabbedPane
          tabs={tabs}
          selectedTab={selectedPropertiesTab}
          setSelectedTab={selectPropertiesTab}
          leftToolbar={[
            <ToolbarButton title='Pick locator' toggled={isInspecting} onClick={() => {
              if (!isInspecting)
                selectPropertiesTab('inspector');
              setIsInspecting(!isInspecting);
            }}><svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
                <path d="M450-42v-75q-137-14-228-105T117-450H42v-60h75q14-137 105-228t228-105v-75h60v75q137 14 228 105t105 228h75v60h-75q-14 137-105 228T510-117v75h-60Zm30-134q125 0 214.5-89.5T784-480q0-125-89.5-214.5T480-784q-125 0-214.5 89.5T176-480q0 125 89.5 214.5T480-176Zm0-154q-63 0-106.5-43.5T330-480q0-63 43.5-106.5T480-630q63 0 106.5 43.5T630-480q0 63-43.5 106.5T480-330Zm0-60q38 0 64-26t26-64q0-38-26-64t-64-26q-38 0-64 26t-26 64q0 38 26 64t64 26Zm0-90Z"/>
              </svg>
            </ToolbarButton>
          ]}
        />
      </SplitView>
      <TabbedPane
        tabs={[
          {
            id: 'actions',
            title: 'Actions',
            component: <ActionList
              sdkLanguage={sdkLanguage}
              actions={model?.actions || []}
              selectedAction={model ? selectedAction : undefined}
              selectedTime={selectedTime}
              onSelected={onActionSelected}
              onHighlighted={setHighlightedAction}
              revealConsole={() => selectPropertiesTab('console')}
              isLive={isLive}
            />
          },
          {
            id: 'metadata',
            title: 'Metadata',
            component: <MetadataView model={model}/>
          },
        ]}
        selectedTab={selectedNavigatorTab} setSelectedTab={setSelectedNavigatorTab}/>
    </SplitView>
  </div>;
};
