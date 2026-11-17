; Installateur Windows de TIMELINE DJ MIX
Unicode true
SetCompressor /SOLID lzma
!include "MUI2.nsh"
!include "FileFunc.nsh"

!define APPNAME "TIMELINE DJ MIX"
!define EXENAME "TIMELINE DJ MIX.exe"
!ifndef VERSION
  !define VERSION "0.3.0"
!endif
!define UNINSTKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\TimelineDjMix"

Name "${APPNAME}"
OutFile "dist\Timeline-DJ-Mix-Windows-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\${APPNAME}"
InstallDirRegKey HKCU "Software\TimelineDjMix" "InstallDir"
RequestExecutionLevel user
BrandingText "${APPNAME} ${VERSION}"

VIProductVersion "0.3.0.0"
VIAddVersionKey /LANG=1036 "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=1036 "FileDescription" "Installation de ${APPNAME}"
VIAddVersionKey /LANG=1036 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1036 "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=1036 "CompanyName" "DJ LATIN JAZZ & DJ CRISLATINO"
VIAddVersionKey /LANG=1036 "LegalCopyright" "© 2026 DJ LATIN JAZZ & DJ CRISLATINO, en collaboration avec Claude.ai — GNU GPL v2+"

!define MUI_ICON "build\icon.ico"
!define MUI_UNICON "build\icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Installation de ${APPNAME}"
!define MUI_WELCOMEPAGE_TEXT "TIMELINE DJ MIX, par DJ LATIN JAZZ && DJ CRISLATINO en collaboration avec Claude.ai, monte votre mix sur une timeline : enchaînements calés, Auto DJ par styles, effets, pré-écoute au casque et contrôleurs MIDI.$\r$\n$\r$\nCliquez sur Suivant pour continuer."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXENAME}"
!define MUI_FINISHPAGE_RUN_TEXT "Lancer ${APPNAME}"

!insertmacro MUI_PAGE_WELCOME
!define MUI_LICENSEPAGE_TEXT_TOP "TIMELINE DJ MIX est un logiciel libre, distribué sous licence GNU GPL version 2 ou ultérieure."
!define MUI_LICENSEPAGE_BUTTON "Suivant >"
!define MUI_LICENSEPAGE_TEXT_BOTTOM "Vous pouvez utiliser, étudier, modifier et partager ce logiciel. Une version modifiée doit rester sous la même licence. Cliquez sur Suivant pour continuer."
!insertmacro MUI_PAGE_LICENSE "LICENSE-GPL-2.0.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "French"

Section "TIMELINE DJ MIX" SecMain
  SetShellVarContext current
  ; ferme une instance en cours avant de remplacer les fichiers
  nsExec::Exec 'taskkill /IM "${EXENAME}" /F /T'
  Sleep 1000
  SetOutPath "$INSTDIR"
  File /r "dist\win-unpacked\*.*"
  WriteUninstaller "$INSTDIR\Désinstaller ${APPNAME}.exe"
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0
  CreateShortcut "$SMPROGRAMS\${APPNAME}\Désinstaller ${APPNAME}.lnk" "$INSTDIR\Désinstaller ${APPNAME}.exe"
  CreateShortcut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXENAME}" "" "$INSTDIR\${EXENAME}" 0
  WriteRegStr HKCU "Software\TimelineDjMix" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTKEY}" "Publisher" "DJ LATIN JAZZ & DJ CRISLATINO"
  WriteRegStr HKCU "${UNINSTKEY}" "DisplayIcon" "$INSTDIR\${EXENAME}"
  WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTKEY}" "UninstallString" '"$INSTDIR\Désinstaller ${APPNAME}.exe"'
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTKEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINSTKEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  nsExec::Exec 'taskkill /IM "${EXENAME}" /F /T'
  Sleep 1000
  Delete "$DESKTOP\${APPNAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APPNAME}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINSTKEY}"
  DeleteRegKey HKCU "Software\TimelineDjMix"
SectionEnd
