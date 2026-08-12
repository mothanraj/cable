const packageService = require("./package.service");

async function getPackages(req, res, next) {
  try {
    const packages = await packageService.getPackages();

    return res.status(200).json({
      success: true,
      data: {
        packages,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getPackageById(req, res, next) {
  try {
    const packageItem = await packageService.getPackageById(
      req.params.packageId
    );

    if (!packageItem) {
      return res.status(404).json({
        success: false,
        error: {
          code: "PACKAGE_NOT_FOUND",
          message: "Package not found.",
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        package: packageItem,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPackages,
  getPackageById,
};