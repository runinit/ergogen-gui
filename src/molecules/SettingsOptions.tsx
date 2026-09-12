import { useConfigContext } from '../context/ConfigContext';
import GenOption from '../atoms/GenOption';
import { SettingsCard, SettingsGroupTitle } from '../atoms/SettingsLayout';

export default function SettingsOptions({
  mode = 'legacy',
}: {
  mode?: 'legacy' | 'native';
}) {
  const context = useConfigContext();
  if (!context) {
    return null;
  }
  return (
    <>
      {mode === 'legacy' && (
        <>
          <SettingsGroupTitle>General</SettingsGroupTitle>
          <SettingsCard>
            <GenOption
              optionId={'autogen'}
              label={'Auto-generate'}
              description={
                'Automatically generate new outputs and update previews on changes.'
              }
              setSelected={context.setAutoGen}
              checked={context.autoGen}
              aria-label="Enable auto-generate"
            />
            <GenOption
              optionId={'autogen3d'}
              label={'Auto-generate PCB & 3D'}
              description={
                'Build 3D models and PCB files during generation (can be slow).'
              }
              setSelected={context.setAutoGen3D}
              checked={context.autoGen3D}
              aria-label="Enable auto-generate PCB and 3D (slow)"
            />
            <GenOption
              optionId={'debug'}
              label={'Debug'}
              description={'Include debug files in the outputs.'}
              setSelected={context.setDebug}
              checked={context.debug}
              aria-label="Enable debug mode"
            />
          </SettingsCard>

          <SettingsGroupTitle>Previews (Experimental)</SettingsGroupTitle>
          <SettingsCard>
            <GenOption
              optionId={'kicanvasPreview'}
              label={'KiCad Preview'}
              description={'Render interactive PCB layouts using KiCanvas.'}
              setSelected={context.setKicanvasPreview}
              checked={context.kicanvasPreview}
              aria-label="Enable KiCad preview (experimental)"
            />
            <GenOption
              optionId={'stlPreview'}
              label={'STL Preview'}
              description={'Render 3D preview of generated cases.'}
              setSelected={context.setStlPreview}
              checked={context.stlPreview}
              aria-label="Enable STL preview (experimental)"
            />
          </SettingsCard>
        </>
      )}
      <SettingsGroupTitle>Privacy</SettingsGroupTitle>
      <SettingsCard>
        <GenOption
          optionId={'sendUsageMetrics'}
          label={'Send Usage Metrics'}
          description={
            'Help improve Ergogen Web UI by sharing anonymous usage statistics.'
          }
          setSelected={context.setSendUsageMetrics}
          checked={context.sendUsageMetrics}
          aria-label="Send usage metrics"
        />
      </SettingsCard>
    </>
  );
}
