const Docker = require('dockerode');
const logger = require('../utils/logger');

/**
 * Docker Controller
 * Handles Docker container and image management operations
 * Uses Dockerode library for Docker API integration
 */

// Initialize Dockerode with Unix socket
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// SECURITY: Whitelist of allowed volume mount paths
// Only these host paths can be mounted into containers
const ALLOWED_VOLUME_PATHS = [
  '/data/openvpn',
  '/etc/openvpn',
  '/var/lib/openvpn'
];

/**
 * Validate volume mount paths against whitelist
 * @param {Array} volumes - Array of volume mount strings (format: "host:container")
 * @returns {Object} - { valid: boolean, invalidPaths: Array }
 */
const validateVolumeMounts = (volumes) => {
  if (!volumes || volumes.length === 0) {
    return { valid: true, invalidPaths: [] };
  }

  const invalidPaths = [];

  for (const volume of volumes) {
    // Parse volume string (format: "host:container" or "host:container:mode")
    const parts = volume.split(':');
    const hostPath = parts[0];

    // Check if host path starts with any allowed path
    const isAllowed = ALLOWED_VOLUME_PATHS.some(allowedPath =>
      hostPath.startsWith(allowedPath)
    );

    if (!isAllowed) {
      invalidPaths.push(hostPath);
    }
  }

  return {
    valid: invalidPaths.length === 0,
    invalidPaths
  };
};

/**
 * List all Docker containers
 * Query params:
 * - all: Show all containers (default: true)
 * - limit: Limit number of containers (default: all)
 * - filters: JSON string for filtering (e.g., {"status": ["running"]})
 */
const listContainers = async (req, res, next) => {
  try {
    const { all = 'true', limit, filters } = req.query;

    const options = {
      all: all === 'true',
      limit: limit ? parseInt(limit, 10) : undefined
    };

    // Parse filters if provided
    if (filters) {
      try {
        options.filters = JSON.parse(filters);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid filters format. Must be valid JSON.'
        });
      }
    }

    logger.info(`Admin ${req.user.email} listing Docker containers`, { options });

    const containers = await docker.listContainers(options);

    // Format container data
    const formattedContainers = containers.map(container => ({
      id: container.Id,
      shortId: container.Id.substring(0, 12),
      names: container.Names.map(name => name.replace(/^\//, '')),
      image: container.Image,
      imageID: container.ImageID,
      command: container.Command,
      created: container.Created,
      state: container.State,
      status: container.Status,
      ports: container.Ports,
      labels: container.Labels,
      networks: Object.keys(container.NetworkSettings?.Networks || {}),
      mounts: container.Mounts
    }));

    res.json({
      success: true,
      data: {
        containers: formattedContainers,
        count: formattedContainers.length
      }
    });
  } catch (error) {
    logger.error('Error in listContainers:', error);
    next(error);
  }
};

/**
 * Get OpenVPN-specific containers
 * Filters containers with 'openvpn' in name or image
 */
const getOpenVPNContainers = async (req, res, next) => {
  try {
    logger.info(`Admin ${req.user.email} retrieving OpenVPN containers`);

    const containers = await docker.listContainers({ all: true });

    // Filter for OpenVPN containers
    const openvpnContainers = containers.filter(container => {
      const nameMatch = container.Names.some(name =>
        name.toLowerCase().includes('openvpn')
      );
      const imageMatch = container.Image.toLowerCase().includes('openvpn');
      return nameMatch || imageMatch;
    });

    const formattedContainers = openvpnContainers.map(container => ({
      id: container.Id,
      shortId: container.Id.substring(0, 12),
      names: container.Names.map(name => name.replace(/^\//, '')),
      image: container.Image,
      created: container.Created,
      state: container.State,
      status: container.Status,
      ports: container.Ports,
      networks: Object.keys(container.NetworkSettings?.Networks || {})
    }));

    res.json({
      success: true,
      data: {
        containers: formattedContainers,
        count: formattedContainers.length
      }
    });
  } catch (error) {
    logger.error('Error in getOpenVPNContainers:', error);
    next(error);
  }
};

/**
 * Get detailed information about a specific container
 */
const getContainerDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info(`Admin ${req.user.email} retrieving container details for: ${id}`);

    const container = docker.getContainer(id);
    const data = await container.inspect();

    // Format detailed container information
    const details = {
      id: data.Id,
      name: data.Name.replace(/^\//, ''),
      created: data.Created,
      path: data.Path,
      args: data.Args,
      state: {
        status: data.State.Status,
        running: data.State.Running,
        paused: data.State.Paused,
        restarting: data.State.Restarting,
        exitCode: data.State.ExitCode,
        startedAt: data.State.StartedAt,
        finishedAt: data.State.FinishedAt,
        health: data.State.Health
      },
      image: data.Image,
      config: {
        hostname: data.Config.Hostname,
        domainname: data.Config.Domainname,
        user: data.Config.User,
        env: data.Config.Env,
        cmd: data.Config.Cmd,
        image: data.Config.Image,
        labels: data.Config.Labels,
        exposedPorts: data.Config.ExposedPorts
      },
      networkSettings: {
        bridge: data.NetworkSettings.Bridge,
        gateway: data.NetworkSettings.Gateway,
        ipAddress: data.NetworkSettings.IPAddress,
        ports: data.NetworkSettings.Ports,
        networks: data.NetworkSettings.Networks
      },
      mounts: data.Mounts.map(mount => ({
        type: mount.Type,
        source: mount.Source,
        destination: mount.Destination,
        mode: mount.Mode,
        rw: mount.RW
      })),
      restartCount: data.RestartCount,
      driver: data.Driver,
      platform: data.Platform,
      hostConfig: {
        restartPolicy: data.HostConfig.RestartPolicy,
        portBindings: data.HostConfig.PortBindings,
        privileged: data.HostConfig.Privileged,
        networkMode: data.HostConfig.NetworkMode
      }
    };

    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    if (error.statusCode === 404) {
      logger.warn(`Container not found: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: 'Container not found'
      });
    }
    logger.error('Error in getContainerDetails:', error);
    next(error);
  }
};

/**
 * Start a container
 */
const startContainer = async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info(`Admin ${req.user.email} starting container: ${id}`);

    const container = docker.getContainer(id);
    await container.start();

    logger.info(`Container ${id} started successfully`);

    res.json({
      success: true,
      message: 'Container started successfully',
      data: { containerId: id }
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: 'Container not found'
      });
    }
    if (error.statusCode === 304) {
      return res.status(200).json({
        success: true,
        message: 'Container already started',
        data: { containerId: req.params.id }
      });
    }
    logger.error('Error in startContainer:', error);
    next(error);
  }
};

/**
 * Stop a container
 * Query params:
 * - timeout: Seconds to wait before killing (default: 10)
 */
const stopContainer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { timeout = '10' } = req.query;

    logger.info(`Admin ${req.user.email} stopping container: ${id}`, { timeout });

    const container = docker.getContainer(id);
    await container.stop({ t: parseInt(timeout, 10) });

    logger.info(`Container ${id} stopped successfully`);

    res.json({
      success: true,
      message: 'Container stopped successfully',
      data: { containerId: id }
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: 'Container not found'
      });
    }
    if (error.statusCode === 304) {
      return res.status(200).json({
        success: true,
        message: 'Container already stopped',
        data: { containerId: req.params.id }
      });
    }
    logger.error('Error in stopContainer:', error);
    next(error);
  }
};

/**
 * Restart a container
 * Query params:
 * - timeout: Seconds to wait before killing (default: 10)
 */
const restartContainer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { timeout = '10' } = req.query;

    logger.info(`Admin ${req.user.email} restarting container: ${id}`, { timeout });

    const container = docker.getContainer(id);
    await container.restart({ t: parseInt(timeout, 10) });

    logger.info(`Container ${id} restarted successfully`);

    res.json({
      success: true,
      message: 'Container restarted successfully',
      data: { containerId: id }
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: 'Container not found'
      });
    }
    logger.error('Error in restartContainer:', error);
    next(error);
  }
};

/**
 * Get container logs
 * Query params:
 * - tail: Number of lines to tail (default: 100)
 * - follow: Stream logs (default: false)
 * - stdout: Show stdout (default: true)
 * - stderr: Show stderr (default: true)
 * - timestamps: Show timestamps (default: true)
 */
const getContainerLogs = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      tail = '100',
      follow = 'false',
      stdout = 'true',
      stderr = 'true',
      timestamps = 'true'
    } = req.query;

    logger.info(`Admin ${req.user.email} retrieving logs for container: ${id}`, {
      tail,
      follow
    });

    const container = docker.getContainer(id);

    const logOptions = {
      follow: follow === 'true',
      stdout: stdout === 'true',
      stderr: stderr === 'true',
      timestamps: timestamps === 'true',
      tail: parseInt(tail, 10)
    };

    const logs = await container.logs(logOptions);

    // Convert buffer to string and clean up Docker log format
    const logString = logs.toString('utf8');
    const cleanedLogs = logString
      .split('\n')
      .map(line => line.replace(/^[\x00-\x08]/, '').trim())
      .filter(line => line.length > 0)
      .join('\n');

    res.json({
      success: true,
      data: {
        containerId: id,
        logs: cleanedLogs,
        linesReturned: cleanedLogs.split('\n').length
      }
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: 'Container not found'
      });
    }
    logger.error('Error in getContainerLogs:', error);
    next(error);
  }
};

/**
 * Get container statistics (CPU, memory, network, etc.)
 * Query params:
 * - stream: Stream stats (default: false)
 */
const getContainerStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stream = 'false' } = req.query;

    logger.info(`Admin ${req.user.email} retrieving stats for container: ${id}`);

    const container = docker.getContainer(id);
    const stats = await container.stats({ stream: stream === 'true' });

    // If not streaming, parse the single stats object
    if (stream === 'false') {
      const statsData = await new Promise((resolve, reject) => {
        let data = '';
        stats.on('data', chunk => {
          data += chunk.toString();
        });
        stats.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
        stats.on('error', reject);
      });

      // Calculate CPU percentage
      const cpuDelta = statsData.cpu_stats.cpu_usage.total_usage -
                      (statsData.precpu_stats.cpu_usage?.total_usage || 0);
      const systemDelta = statsData.cpu_stats.system_cpu_usage -
                         (statsData.precpu_stats.system_cpu_usage || 0);
      const cpuPercent = systemDelta > 0 ?
        (cpuDelta / systemDelta) * statsData.cpu_stats.online_cpus * 100 : 0;

      // Calculate memory percentage
      const memoryUsage = statsData.memory_stats.usage || 0;
      const memoryLimit = statsData.memory_stats.limit || 1;
      const memoryPercent = (memoryUsage / memoryLimit) * 100;

      // Network stats
      const networks = statsData.networks || {};
      const networkStats = Object.entries(networks).reduce((acc, [name, net]) => {
        acc[name] = {
          rxBytes: net.rx_bytes,
          txBytes: net.tx_bytes,
          rxPackets: net.rx_packets,
          txPackets: net.tx_packets
        };
        return acc;
      }, {});

      const formattedStats = {
        containerId: id,
        read: statsData.read,
        cpu: {
          usage: cpuPercent.toFixed(2),
          systemUsage: statsData.cpu_stats.system_cpu_usage,
          onlineCpus: statsData.cpu_stats.online_cpus
        },
        memory: {
          usage: memoryUsage,
          usageMB: (memoryUsage / 1024 / 1024).toFixed(2),
          limit: memoryLimit,
          limitMB: (memoryLimit / 1024 / 1024).toFixed(2),
          percent: memoryPercent.toFixed(2),
          cache: statsData.memory_stats.stats?.cache || 0
        },
        network: networkStats,
        blockIO: {
          read: statsData.blkio_stats.io_service_bytes_recursive?.find(
            item => item.op === 'Read'
          )?.value || 0,
          write: statsData.blkio_stats.io_service_bytes_recursive?.find(
            item => item.op === 'Write'
          )?.value || 0
        },
        pids: statsData.pids_stats?.current || 0
      };

      res.json({
        success: true,
        data: formattedStats
      });
    } else {
      // For streaming, send as event stream
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      stats.on('data', chunk => {
        res.write(`data: ${chunk.toString()}\n\n`);
      });

      stats.on('end', () => {
        res.end();
      });

      stats.on('error', error => {
        logger.error('Error streaming stats:', error);
        res.end();
      });
    }
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: 'Container not found'
      });
    }
    logger.error('Error in getContainerStats:', error);
    next(error);
  }
};

/**
 * Create a new OpenVPN container
 * Body params:
 * - name: Container name (required)
 * - port: Host port to bind (default: 1194)
 * - volumes: Array of volume mappings (optional, validated against whitelist)
 * - env: Array of environment variables (optional)
 * - image: Docker image to use (default: 'kylemanna/openvpn')
 *
 * SECURITY NOTES:
 * - Volume mounts are validated against whitelist to prevent arbitrary host access
 * - Privileged mode is DISABLED by default for security
 * - Only NET_ADMIN capability is granted (required for VPN functionality)
 * - RestartPolicy is set to prevent resource exhaustion
 */
const createOpenVPNContainer = async (req, res, next) => {
  try {
    const {
      name,
      port = 1194,
      volumes = [],
      env = [],
      image = 'kylemanna/openvpn'
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Container name is required'
      });
    }

    // SECURITY: Validate volume mounts against whitelist
    const volumeValidation = validateVolumeMounts(volumes);
    if (!volumeValidation.valid) {
      logger.warn(`Admin ${req.user.email} attempted to mount unauthorized volumes`, {
        invalidPaths: volumeValidation.invalidPaths
      });
      return res.status(403).json({
        success: false,
        message: 'Unauthorized volume mount paths detected',
        data: {
          invalidPaths: volumeValidation.invalidPaths,
          allowedPaths: ALLOWED_VOLUME_PATHS
        }
      });
    }

    logger.info(`Admin ${req.user.email} creating OpenVPN container`, {
      name,
      port,
      image,
      volumes: volumes.length
    });

    // Check if container with same name exists
    const existingContainers = await docker.listContainers({ all: true });
    const nameExists = existingContainers.some(container =>
      container.Names.some(n => n === `/${name}`)
    );

    if (nameExists) {
      return res.status(409).json({
        success: false,
        message: 'Container with this name already exists'
      });
    }

    // SECURITY FIX: Create container configuration with least privilege principle
    const containerConfig = {
      Image: image,
      name: name,
      Hostname: name,
      Env: env,
      ExposedPorts: {
        '1194/udp': {}
      },
      HostConfig: {
        PortBindings: {
          '1194/udp': [{ HostPort: String(port) }]
        },
        Binds: volumes,
        // SECURITY: Only grant NET_ADMIN capability (required for VPN/network operations)
        // This is more secure than privileged mode while still allowing VPN functionality
        CapAdd: ['NET_ADMIN'],
        // SECURITY FIX: Privileged mode DISABLED
        // Privileged mode allows container escape and should never be used
        Privileged: false,
        // Restart policy to prevent resource exhaustion
        RestartPolicy: {
          Name: 'unless-stopped',
          MaximumRetryCount: 0
        },
        // Additional security settings
        SecurityOpt: ['no-new-privileges:true'],
        // Resource limits to prevent DoS
        Memory: 512 * 1024 * 1024, // 512MB limit
        MemorySwap: 1024 * 1024 * 1024, // 1GB swap limit
        CpuShares: 1024 // Default CPU shares
      }
    };

    const container = await docker.createContainer(containerConfig);

    logger.info(`OpenVPN container created: ${container.id}`, {
      name,
      privileged: false,
      capabilities: ['NET_ADMIN']
    });

    res.status(201).json({
      success: true,
      message: 'OpenVPN container created successfully',
      data: {
        containerId: container.id,
        name: name,
        port: port,
        image: image,
        securityProfile: {
          privileged: false,
          capabilities: ['NET_ADMIN'],
          volumesValidated: true
        }
      }
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: 'Docker image not found. Please pull the image first.'
      });
    }
    logger.error('Error in createOpenVPNContainer:', error);
    next(error);
  }
};

/**
 * Remove a container
 * Query params:
 * - force: Force removal of running container (default: false)
 * - volumes: Remove associated volumes (default: false)
 */
const removeContainer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { force = 'false', volumes = 'false' } = req.query;

    logger.info(`Admin ${req.user.email} removing container: ${id}`, {
      force,
      volumes
    });

    const container = docker.getContainer(id);

    const removeOptions = {
      force: force === 'true',
      v: volumes === 'true'
    };

    await container.remove(removeOptions);

    logger.info(`Container ${id} removed successfully`);

    res.json({
      success: true,
      message: 'Container removed successfully',
      data: { containerId: id }
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: 'Container not found'
      });
    }
    if (error.statusCode === 409) {
      return res.status(409).json({
        success: false,
        message: 'Cannot remove running container. Use force=true to override.'
      });
    }
    logger.error('Error in removeContainer:', error);
    next(error);
  }
};

/**
 * Get Docker system information
 */
const getDockerInfo = async (req, res, next) => {
  try {
    logger.info(`Admin ${req.user.email} retrieving Docker system info`);

    const info = await docker.info();
    const version = await docker.version();

    const formattedInfo = {
      version: {
        version: version.Version,
        apiVersion: version.ApiVersion,
        goVersion: version.GoVersion,
        os: version.Os,
        arch: version.Arch,
        kernelVersion: version.KernelVersion,
        buildTime: version.BuildTime
      },
      system: {
        name: info.Name,
        serverVersion: info.ServerVersion,
        operatingSystem: info.OperatingSystem,
        osType: info.OSType,
        architecture: info.Architecture,
        cpus: info.NCPU,
        memory: {
          total: info.MemTotal,
          totalGB: (info.MemTotal / 1024 / 1024 / 1024).toFixed(2)
        }
      },
      containers: {
        total: info.Containers,
        running: info.ContainersRunning,
        paused: info.ContainersPaused,
        stopped: info.ContainersStopped
      },
      images: info.Images,
      storage: {
        driver: info.Driver,
        driverStatus: info.DriverStatus
      },
      runtime: {
        defaultRuntime: info.DefaultRuntime,
        runtimes: Object.keys(info.Runtimes || {})
      },
      plugins: {
        volume: info.Plugins?.Volume || [],
        network: info.Plugins?.Network || [],
        log: info.Plugins?.Log || []
      },
      docker: {
        rootDir: info.DockerRootDir,
        live: true
      }
    };

    res.json({
      success: true,
      data: formattedInfo
    });
  } catch (error) {
    logger.error('Error in getDockerInfo:', error);
    next(error);
  }
};

/**
 * List Docker images
 * Query params:
 * - all: Show all images (default: false)
 * - filters: JSON string for filtering
 */
const listImages = async (req, res, next) => {
  try {
    const { all = 'false', filters } = req.query;

    const options = {
      all: all === 'true'
    };

    if (filters) {
      try {
        options.filters = JSON.parse(filters);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Invalid filters format. Must be valid JSON.'
        });
      }
    }

    logger.info(`Admin ${req.user.email} listing Docker images`, { options });

    const images = await docker.listImages(options);

    const formattedImages = images.map(image => ({
      id: image.Id,
      shortId: image.Id.split(':')[1]?.substring(0, 12) || image.Id.substring(0, 12),
      repoTags: image.RepoTags || [],
      repoDigests: image.RepoDigests || [],
      created: image.Created,
      size: image.Size,
      sizeMB: (image.Size / 1024 / 1024).toFixed(2),
      virtualSize: image.VirtualSize,
      containers: image.Containers,
      labels: image.Labels
    }));

    res.json({
      success: true,
      data: {
        images: formattedImages,
        count: formattedImages.length
      }
    });
  } catch (error) {
    logger.error('Error in listImages:', error);
    next(error);
  }
};

/**
 * Pull a Docker image from registry
 * Body params:
 * - imageName: Image name with optional tag (required)
 * - tag: Image tag (default: 'latest')
 */
const pullImage = async (req, res, next) => {
  try {
    const { imageName, tag = 'latest' } = req.body;

    if (!imageName) {
      return res.status(400).json({
        success: false,
        message: 'Image name is required'
      });
    }

    const fullImageName = imageName.includes(':') ? imageName : `${imageName}:${tag}`;

    logger.info(`Admin ${req.user.email} pulling Docker image: ${fullImageName}`);

    // Pull image and track progress
    const stream = await docker.pull(fullImageName);

    // Process the stream
    await new Promise((resolve, reject) => {
      docker.modem.followProgress(
        stream,
        (error, output) => {
          if (error) {
            reject(error);
          } else {
            resolve(output);
          }
        },
        (event) => {
          // Log progress events
          if (event.status && event.id) {
            logger.debug(`Pull progress: ${event.id} - ${event.status} ${event.progress || ''}`);
          }
        }
      );
    });

    logger.info(`Image ${fullImageName} pulled successfully`);

    res.json({
      success: true,
      message: 'Image pulled successfully',
      data: {
        imageName: fullImageName
      }
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: 'Image not found in registry'
      });
    }
    logger.error('Error in pullImage:', error);
    next(error);
  }
};

module.exports = {
  listContainers,
  getOpenVPNContainers,
  getContainerDetails,
  startContainer,
  stopContainer,
  restartContainer,
  getContainerLogs,
  getContainerStats,
  createOpenVPNContainer,
  removeContainer,
  getDockerInfo,
  listImages,
  pullImage
};
