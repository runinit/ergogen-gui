import { CONTROLLERS } from './designSetup';
import { loadComponentModel } from './componentModels';
import catalogue from '../catalogue/footprints.json';

export async function componentPackage(choice: string) {
  const controller = CONTROLLERS.find((item) => item.id === choice);
  const model = controller?.model
    ? await loadComponentModel(controller.model)
    : undefined;
  return {
    assets: model?.assets || {},
    injections: controller?.provider.startsWith('catalogue/')
      ? [
          [
            'footprint',
            controller.provider,
            (catalogue as Record<string, string>)[controller.provider],
          ],
        ]
      : [],
  };
}
