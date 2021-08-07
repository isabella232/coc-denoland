// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

/** Contains handlers for commands that are enabled in Visual Studio Code for
 * the extension. */

import {
  ENABLEMENT_FLAG,
  EXTENSION_NS,
  LANGUAGE_CLIENT_ID,
  LANGUAGE_CLIENT_NAME,
  SERVER_SEMVER,
} from "./constants";
// NOTE(coc.nvim): Interactive initialization.
// import { pickInitWorkspace } from "./initialize_project";
import {
  cache as cacheReq,
  reloadImportRegistries as reloadImportRegistriesReq,
} from "./lsp_extensions";
import * as tasks from "./tasks";
import type {DenoExtensionContext} from "./types";
// NOTE(coc.nvim): WebviewPanel is not supported at all.
// import {WelcomePanel} from "./welcome";
import {assert, getDenoCommand} from "./util";
import {registryState} from "./lsp_extensions";
// NOTE(coc.nvim): help wanted. wip
// import {createRegistryStateHandler} from "./notification_handlers";

import * as semver from "semver";
// NOTE(coc.nvim): Some vscode features are missing
import {
  commands,
  ExtensionContext,
  // ProgressLocation,
  Uri,
  // ViewColumn,
  window,
  workspace,
} from "coc.nvim";
import {
  // DocumentUri,
  LanguageClient,
  ServerOptions,
  Location,
  Position,
} from "coc.nvim";
import * as vscode from "coc.nvim"

// deno-lint-ignore no-explicit-any
export type Callback = (...args: any[]) => unknown;
export type Factory = (
  context: ExtensionContext,
  extensionContext: DenoExtensionContext,
) => Callback;

/** For the current document active in the editor tell the Deno LSP to cache
 * the file and all of its dependencies in the local cache. */
export function cache(
  context: ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return async () => {
    // NOTE(coc.nvim): currentState instead of active editor
    // const activeEditor = vscode.window.activeTextEditor;
    const client = extensionContext.client;
    // const activeEditor = window.activeTextEditor;
    // if (!activeEditor) {
    //   return;
    // }
    const currentState = await workspace.getCurrentState();
    return window.withProgress({
      // NOTE(coc.nvim): No location
      // location: ProgressLocation.Window,
      title: "caching",
    }, async () => {
      let canceled = false
      const cancel = () => canceled = true;
      context.subscriptions.push({
        dispose: cancel
      });
      client?.sendRequest(
        cacheReq,
        {
          referrer: {uri: currentState.document.uri.toString()},
          uris: [],
          textDocument: {uri: currentState.document.uri.toString()},
        },
      ).then(cancel).catch(async (e: unknown) => {
        cancel();
        // XXX: For some reason, error occured every time I cache...
        // await window.showErrorMessage("Error while caching.");
      });
      while (!canceled) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
  };
}

export function initializeWorkspace(
  _context: ExtensionContext,
  _extensionContext: DenoExtensionContext,
): Callback {
  return async () => {
    try {
      // NOTE(coc.nvim): vscode_deno uses interactive picking configuration.
      // const settings = await pickInitWorkspace();
      const lint = await window.showPrompt("Enable Deno linting?");
      const unstable = await window.showPrompt("Endable Deno unstable APIs?");

      const config = workspace.getConfiguration(EXTENSION_NS);
      // await config.update("enable", true);
      // await config.update("lint", settings.lint);
      // await config.update("unstable", settings.unstable);
      config.update("enable", true);
      config.update("lint", lint);
      config.update("unstable", unstable);

      // NOTE(coc.nvim): Configure tsserver and restart.
      const tsServerConfig = workspace.getConfiguration("tsserver");
      tsServerConfig.update("enable", false);
      await commands.executeCommand("tsserver.restart");

      await window.showInformationMessage(
        "Deno is now setup in this workspace.",
      );
    } catch {
      window.showErrorMessage("Deno project initialization failed.");
    }
  };
}

export function reloadImportRegistries(
  _context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return () => extensionContext.client?.sendRequest(reloadImportRegistriesReq);
}

/** Start (or restart) the Deno Language Server */
export function startLanguageServer(
  context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return async () => {
    // Stop the existing language server and reset the state
    const {statusBarItem} = extensionContext;
    if (extensionContext.client) {
      const client = extensionContext.client;
      extensionContext.client = undefined;
      statusBarItem.hide();
      // vscode.commands.executeCommand("setContext", ENABLEMENT_FLAG, false);
      await client.stop();
    }

    // Start a new language server
    const command = await getDenoCommand();
    const serverOptions: ServerOptions = {
      run: {
        command,
        args: ["lsp"],
        // deno-lint-ignore no-undef
        options: {env: {...process.env, "NO_COLOR": true}},
      },
      debug: {
        command,
        // disabled for now, as this gets super chatty during development
        // args: ["lsp", "-L", "debug"],
        args: ["lsp"],
        // deno-lint-ignore no-undef
        options: {env: {...process.env, "NO_COLOR": true}},
      },
    };
    const client = new LanguageClient(
      LANGUAGE_CLIENT_ID,
      LANGUAGE_CLIENT_NAME,
      serverOptions,
      extensionContext.clientOptions,
    );
    context.subscriptions.push(client.start());
    await client.onReady();

    // set this after a successful start
    extensionContext.client = client;

    // vscode.commands.executeCommand("setContext", ENABLEMENT_FLAG, true);
    const serverVersion = extensionContext.serverVersion =
      (client.initializeResult?.serverInfo?.version ?? "")
        .split(
          " ",
        )[0];
    statusBarItem.text = `Deno ${serverVersion}`;
    // NOTE(coc.nvim): tooltip is not supported.
    // statusBarItem.tooltip = client
    //   .initializeResult?.serverInfo?.version;
    statusBarItem.show();

    // NOTE(coc.nvim): onNotification is not disposable.
    // context.subscriptions.push(
    // NOTE(coc.nvim): help wanted. wip
    // client.onNotification(
    //   registryState,
    //   createRegistryStateHandler(),
    // ),
    // );

    extensionContext.tsApi?.refresh();

    if (
      semver.valid(extensionContext.serverVersion) &&
      !semver.satisfies(extensionContext.serverVersion, SERVER_SEMVER)
    ) {
      notifyServerSemver(extensionContext.serverVersion);
    } else {
      showWelcomePageIfFirstUse(context, extensionContext);
    }
  };
}

function notifyServerSemver(serverVersion: string) {
  return vscode.window.showWarningMessage(
    `The version of Deno language server ("${serverVersion}") does not meet the requirements of the extension ("${SERVER_SEMVER}"). Please update Deno and restart.`,
    "OK",
  );
}

function showWelcomePageIfFirstUse(
  context: vscode.ExtensionContext,
  extensionContext: DenoExtensionContext,
) {
  const welcomeShown = context.globalState.get<boolean>("deno.welcomeShown") ??
    false;

  if (!welcomeShown) {
    // NOTE(coc.nvim): WebviewPanel is not supported at all.
    // welcome(context, extensionContext)();
    context.globalState.update("deno.welcomeShown", true);
  }
}

// NOTE(coc.nvim): Help wanted. protocol2CodeConverter not found.
export function showReferences(
  _content: ExtensionContext,
  extensionContext: DenoExtensionContext,
): Callback {
  return (uri: string, position: Position, locations: Location[]) => {
    // if (!extensionContext.client) {
    //   return;
    // }
    // vscode.commands.executeCommand(
    //   "editor.action.showReferences",
    //   vscode.Uri.parse(uri),
    //   extensionContext.client.protocol2CodeConverter.asPosition(position),
    //   locations.map(extensionContext.client.protocol2CodeConverter.asLocation),
    // );
  };
}

/** Open and display the "virtual document" which provides the status of the
 * Deno Language Server. */
export function status(
  _context: vscode.ExtensionContext,
  _extensionContext: DenoExtensionContext,
): Callback {
  return async () => {
    // NOTE(coc.nvim): Use getDocument instead
    // const document = await workspace.openTextDocument(
    //   Uri.parse("deno:/status.md"),
    // );
    const document = workspace.getDocument("deno:/status.md")
    // NOTE(coc.nvim): Use show* instead
    // return window.showTextDocument(document, ViewColumn.Two, true);
    if (!document || !document.content) {
      await window.showErrorMessage("No status found.")
      return;
    }
    await window.showDialog({
      content: document.content
    })
    return () => {
      const uri = vscode.Uri.parse("deno:/status.md");
      return vscode.commands.executeCommand("markdown.showPreviewToSide", uri);
    };
  };
}

// NOTE(coc.nvim): task is not supported at all.
/*
export function test(
  _context: vscode.ExtensionContext,
  _extensionContext: DenoExtensionContext,
): Callback {
  return async (uriStr: string, name: string) => {
    const uri = vscode.Uri.parse(uriStr, true);
    const path = uri.fsPath;
    // NOTE(coc.nvim): uri -> uri.toString()
    const config = vscode.workspace.getConfiguration(EXTENSION_NS, uri.toString());
    const testArgs: string[] = [
      ...(config.get<string[]>("codeLens.testArgs") ?? []),
    ];
    if (config.get("unstable")) {
      testArgs.push("--unstable");
    }
    if (config.has("importMap")) {
      testArgs.push("--import-map", String(config.get("importMap")));
    }
    const env = config.has("cache")
      ? {"DENO_DIR": config.get("cache")} as Record<string, string>
      : undefined;
    const args = ["test", ...testArgs, "--filter", name, path];

    const definition: tasks.DenoTaskDefinition = {
      type: tasks.TASK_TYPE,
      command: "test",
      args,
      cwd: ".",
      env,
    };

    assert(vscode.workspace.workspaceFolders);
    const target = vscode.workspace.workspaceFolders[0];
    const task = await tasks.buildDenoTask(
      target,
      definition,
      `test "${name}"`,
      args,
      ["$deno-test"],
    );

    task.presentationOptions = {
      reveal: vscode.TaskRevealKind.Always,
      panel: vscode.TaskPanelKind.Dedicated,
      clear: true,
    };
    task.group = vscode.TaskGroup.Test;

    return vscode.tasks.executeTask(task);
  };
}
*/

// NOTE(coc.nvim): WebviewPanel is not supported at all.
/*
export function welcome(
  context: vscode.ExtensionContext,
  _extensionContext: DenoExtensionContext,
): Callback {
  return () => {
    context.extensionPath
    WelcomePanel.createOrShow(context.extensionUri);
  };
}
*/
