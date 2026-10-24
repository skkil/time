rootProject.name = "time-server"

val storeDir: String =
    file(
        providers
            .gradleProperty("storeDir")
            .orElse(providers.environmentVariable("STORE_DIR"))
            .getOrElse("../../../store"),
    ).absolutePath

gradle.extra["storeDir"] = storeDir

includeBuild("$storeDir/modules/adapter-jvm")
