' run-hidden.vbs - launch watch-task.ps1 with no window at all.
'
' A scheduled task that runs powershell.exe directly flashes a console for a moment even with
' -WindowStyle Hidden: Windows creates the console before PowerShell can apply the style. Six
' channels on a 15-minute cycle makes that six flashes every quarter hour.
'
' wscript.exe has no console of its own, and .Run with intWindowStyle 0 starts the child hidden,
' so nothing is ever drawn. Switching the task principal to S4U also fixes it, but that needs
' administrator rights; this does not.
'
'   wscript.exe run-hidden.vbs <channel-key> [-IncludeDispatch]

Option Explicit

Dim shell, fso, here, worker, cmd, i
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

here = fso.GetParentFolderName(WScript.ScriptFullName)
worker = fso.BuildPath(here, "watch-task.ps1")

If Not fso.FileExists(worker) Then
  WScript.Quit 2
End If

cmd = "powershell.exe -ExecutionPolicy Bypass -NonInteractive -File """ & worker & """"

If WScript.Arguments.Count > 0 Then
  cmd = cmd & " -Channels " & WScript.Arguments(0)
End If

' Anything after the channel is passed straight through, so -IncludeDispatch and -DryRun work.
For i = 1 To WScript.Arguments.Count - 1
  cmd = cmd & " " & WScript.Arguments(i)
Next

' 0 = hidden, True = wait, so the task's Last Run Result is the script's real exit code rather
' than "wscript started successfully".
WScript.Quit shell.Run(cmd, 0, True)
